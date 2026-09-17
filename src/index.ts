import express from 'express';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import type {
  Channel, Contact, Direction, MessageStatus, RawBodyRequest, SendResult, StoredMessage
} from './types.js';
import { extractIncomingText, extractStatuses, sendWhatsAppText, verifyMetaSignature } from './channels/whatsapp.js';
import { describeSendFailure } from './channels/meta-errors.js';
import { generateSalesReply } from './ai/client.js';
import { knowledgeFromConfig } from './knowledge/index.js';
import {
  claimMessage, countsForStatus, getHistory, getOrCreateContact, markHandled,
  releaseClaim, saveMessage, touchInbound, updateLead
} from './db/supabase.js';
import { decideHandoff } from './sales/handoff.js';
import { decayScore, scoreMessage, stageFromScore } from './sales/lead-score.js';
import { createLimiter, type LimitDecision } from './limits/rate-limit.js';
import { registerVoiceRoutes } from './voice/twilio-realtime.js';
import { registerStatusRoutes } from './web/status.js';

type Counts = { contacts: number; messages: number; hot: number };

/**
 * Everything the request handlers touch, passed in rather than imported.
 *
 * This is the only reason the webhook is testable at all: the suite supplies
 * fakes and asserts on behaviour without a database, a model, or a network.
 */
export type AppDeps = {
  verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean;
  claimMessage(messageId: string): Promise<boolean>;
  markHandled(messageId: string): Promise<void>;
  releaseClaim(messageId: string): Promise<void>;
  getOrCreateContact(phone: string, name?: string | null): Promise<Contact>;
  saveMessage(contactId: string, direction: Direction, content: string, channel?: Channel, status?: MessageStatus): Promise<void>;
  getHistory(contactId: string, limit?: number): Promise<StoredMessage[]>;
  updateLead(contactId: string, leadScore: number, stage: string, humanHandoff?: boolean, handoffUntil?: string | null): Promise<void>;
  touchInbound(contactId: string): Promise<void>;
  generateReply(history: StoredMessage[], latest: string, knowledge: string): Promise<string>;
  sendText(to: string, body: string): Promise<SendResult>;
  allow(contactId: string): LimitDecision;
  counts(): Promise<Counts>;
  verifyToken: string;
  knowledge: string;
  handoffHours: number;
  log: { info(...args: unknown[]): void; error(...args: unknown[]): void };
};

const HANDOFF_REPLY =
  'Of course. I am passing this to a person now. Leave any details here and they will have the whole thread when they pick it up.';

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(express.json({
    verify: (req, _res, buf) => { (req as RawBodyRequest).rawBody = Buffer.from(buf); }
  }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => { res.json({ ok: true, uptime: process.uptime() }); });

  app.get('/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === deps.verifyToken) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  });

  app.post('/webhooks/whatsapp', (req, res) => {
    if (!deps.verifySignature((req as RawBodyRequest).rawBody, req.header('x-hub-signature-256'))) {
      res.sendStatus(401);
      return;
    }

    // Acknowledge before any slow work. Meta retries anything it does not get a
    // prompt 200 for, and a retry that arrives mid-reply is exactly what the
    // dedup table exists to absorb.
    res.sendStatus(200);
    void handle(deps, req.body);
  });

  registerStatusRoutes(app, deps.counts);
  return app;
}

async function handle(deps: AppDeps, payload: unknown) {
  for (const update of extractStatuses(payload)) {
    if (update.status !== 'failed') continue;
    const code = update.errorCodes[0] ?? null;
    deps.log.error(`Delivery failed for ${update.messageId}. ${describeSendFailure(code, 'reported by Meta')}`);
  }

  const incoming = extractIncomingText(payload);
  if (!incoming || !incoming.text.trim()) return;

  try {
    // Claim first. Everything after this point costs money or writes rows.
    if (!await deps.claimMessage(incoming.id)) {
      deps.log.info(`Ignoring repeat delivery of ${incoming.id}`);
      return;
    }

    const contact = await deps.getOrCreateContact(incoming.from, incoming.name);
    await deps.saveMessage(contact.id, 'inbound', incoming.text, 'whatsapp', 'sent');
    await deps.touchInbound(contact.id);

    // Decay before adding, so the score reflects interest now rather than the
    // number of messages this contact has ever sent.
    const decayed = decayScore(contact.lead_score ?? 0, contact.last_inbound_at);
    const leadScore = scoreMessage(incoming.text, decayed);
    const stage = stageFromScore(leadScore);

    const handoff = decideHandoff(incoming.text, contact.handoff_until, deps.handoffHours);
    const handoffUntil = handoff.action === 'announce' ? handoff.until : contact.handoff_until;

    await deps.updateLead(contact.id, leadScore, stage, handoff.action !== 'reply', handoffUntil);

    if (handoff.action === 'stay_quiet') {
      deps.log.info(`${incoming.from} is with a human until ${contact.handoff_until}. Not replying.`);
      await deps.markHandled(incoming.id);
      return;
    }

    const decision = deps.allow(contact.id);
    if (!decision.ok) {
      deps.log.error(
        decision.reason === 'daily'
          ? `Daily cap of ${config.DAILY_MESSAGE_CAP} replies reached. Not replying to ${incoming.from}. Raise DAILY_MESSAGE_CAP if this is normal traffic.`
          : `${incoming.from} is sending faster than the per-contact limit allows. Not replying to this one.`
      );
      await deps.markHandled(incoming.id);
      return;
    }

    const reply = handoff.action === 'announce'
      ? HANDOFF_REPLY
      : await deps.generateReply(await deps.getHistory(contact.id, 14), incoming.text, deps.knowledge);

    const result = await deps.sendText(incoming.from, reply);
    if (result.ok) {
      await deps.saveMessage(contact.id, 'outbound', reply, 'whatsapp', 'sent');
    } else {
      await deps.saveMessage(contact.id, 'outbound', reply, 'whatsapp', 'failed');
      deps.log.error(describeSendFailure(result.code, result.detail));
    }

    await deps.markHandled(incoming.id);
  } catch (error) {
    deps.log.error('Failed to process WhatsApp message:', error);
    // Give the claim back so Meta's next retry can pick it up straight away
    // instead of waiting out the stale window for a failure we already know of.
    await deps.releaseClaim(incoming.id).catch((releaseError) => {
      deps.log.error('Could not release the claim on', incoming.id, releaseError);
    });
  }
}

async function main() {
  const knowledge = await knowledgeFromConfig().load();
  const limiter = createLimiter({
    burst: config.PER_CONTACT_BURST,
    refillMs: config.PER_CONTACT_REFILL_MS,
    dailyCap: config.DAILY_MESSAGE_CAP
  });

  const app = createApp({
    verifySignature: verifyMetaSignature,
    claimMessage,
    markHandled,
    releaseClaim,
    getOrCreateContact,
    saveMessage,
    getHistory,
    updateLead,
    touchInbound,
    generateReply: generateSalesReply,
    sendText: sendWhatsAppText,
    allow: (contactId) => limiter.allow(contactId),
    counts: countsForStatus,
    verifyToken: config.WHATSAPP_VERIFY_TOKEN,
    knowledge,
    handoffHours: config.HANDOFF_HOURS,
    log: { info: console.log, error: console.error }
  });

  const server = createServer(app);
  registerVoiceRoutes(app, server, knowledge);

  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`AI Sales Agent listening on port ${config.PORT}`);
  });
}

// Only run the server when started directly, so importing this file in a test
// does not bind a port.
//
// pathToFileURL rather than building the string by hand: on Windows a file URL
// is file:///C:/... with three slashes, so a hand-built file://C:/... never
// matches and the server silently does nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
