import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type AppDeps } from '../src/index.js';
import { fetch_app, post_app } from './http.js';

const SECRET = 'a'.repeat(32);

function signed(payload: unknown, secret = SECRET) {
  const body = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
  return { body, signature };
}

function deps(overrides: Partial<AppDeps> = {}) {
  const base = {
    verifySignature: (raw: Buffer | undefined, header: string | undefined) => {
      if (!raw || !header) return false;
      const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
      return expected === header;
    },
    claimMessage: vi.fn(async () => true),
    markHandled: vi.fn(async () => {}),
    releaseClaim: vi.fn(async () => {}),
    getOrCreateContact: vi.fn(async () => ({
      id: 'contact-1', phone: '1', name: null, lead_score: 0,
      stage: 'new', human_handoff: false, handoff_until: null, last_inbound_at: null
    })),
    saveMessage: vi.fn(async () => {}),
    getHistory: vi.fn(async () => []),
    updateLead: vi.fn(async () => {}),
    touchInbound: vi.fn(async () => {}),
    generateReply: vi.fn(async () => 'We are open Tuesday to Saturday.'),
    sendText: vi.fn(async () => ({ ok: true as const, messageId: 'wamid.out' })),
    allow: () => ({ ok: true as const }),
    counts: vi.fn(async () => ({ contacts: 0, messages: 0, hot: 0 })),
    verifyToken: 'verify-me',
    knowledge: 'Haircut is 20.',
    handoffHours: 24,
    log: { info: vi.fn(), error: vi.fn() },
    ...overrides
  };
  return base as unknown as AppDeps & typeof base;
}

const inbound = {
  entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: 'Sam' } }],
    messages: [{ id: 'wamid.IN', from: '447700900000', type: 'text', text: { body: 'what time do you open' } }]
  } }] }]
};

/** Waits for the handler's post-ack work, which runs after the 200 is sent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('GET /webhooks/whatsapp', () => {
  it('echoes the challenge when the verify token matches', async () => {
    const res = await fetch_app(createApp(deps()), '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345');
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('refuses a wrong verify token', async () => {
    const res = await fetch_app(createApp(deps()), '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1');
    expect(res.status).toBe(403);
  });
});

describe('POST /webhooks/whatsapp', () => {
  it('refuses an unsigned request without doing any work', async () => {
    const d = deps();
    const res = await post_app(createApp(d), '/webhooks/whatsapp', JSON.stringify(inbound), undefined);
    expect(res.status).toBe(401);
    await settle();
    expect(d.claimMessage).not.toHaveBeenCalled();
  });

  it('refuses a request signed with the wrong secret', async () => {
    const d = deps();
    const { body, signature } = signed(inbound, 'b'.repeat(32));
    const res = await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    expect(res.status).toBe(401);
    await settle();
    expect(d.claimMessage).not.toHaveBeenCalled();
  });

  it('answers a signed message once', async () => {
    const d = deps();
    const { body, signature } = signed(inbound);
    const res = await post_app(createApp(d), '/webhooks/whatsapp', body, signature);

    expect(res.status).toBe(200);
    await settle();

    expect(d.claimMessage).toHaveBeenCalledWith('wamid.IN');
    expect(d.generateReply).toHaveBeenCalledOnce();
    expect(d.sendText).toHaveBeenCalledWith('447700900000', 'We are open Tuesday to Saturday.');
    expect(d.touchInbound).toHaveBeenCalledWith('contact-1');
  });

  it('does nothing on a retry of a message it already handled', async () => {
    const d = deps({ claimMessage: vi.fn(async () => false) });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.generateReply).not.toHaveBeenCalled();
    expect(d.sendText).not.toHaveBeenCalled();
  });

  it('stops replying when the limiter says no, without calling the model', async () => {
    const d = deps({ allow: () => ({ ok: false as const, reason: 'daily' as const }) });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.generateReply).not.toHaveBeenCalled();
    expect(d.log.error).toHaveBeenCalled();
  });

  it('answers a handoff request without spending a model call', async () => {
    const d = deps();
    const handoffPayload = {
      entry: [{ changes: [{ value: {
        messages: [{ id: 'wamid.H', from: '1', type: 'text', text: { body: 'let me talk to a human' } }]
      } }] }]
    };
    const { body, signature } = signed(handoffPayload);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.generateReply).not.toHaveBeenCalled();
    expect(d.sendText).toHaveBeenCalledOnce();
    expect(d.updateLead).toHaveBeenCalledWith('contact-1', expect.any(Number), expect.any(String), true, expect.any(String));
  });

  it('records a failed send rather than pretending it went out', async () => {
    const d = deps({
      sendText: vi.fn(async () => ({ ok: false as const, code: 131047, detail: 'Re-engagement message' }))
    });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.saveMessage).toHaveBeenCalledWith('contact-1', 'outbound', expect.any(String), 'whatsapp', 'failed');
    expect(d.log.error.mock.calls.flat().join(' ')).toContain('24 hours');
  });

  it('logs a failed delivery receipt', async () => {
    const d = deps();
    const statuses = {
      entry: [{ changes: [{ value: {
        statuses: [{ id: 'wamid.OUT', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }]
      } }] }]
    };
    const { body, signature } = signed(statuses);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.log.error.mock.calls.flat().join(' ')).toContain('24 hours');
  });

  it('survives the database failing without crashing the process', async () => {
    const d = deps({ getOrCreateContact: vi.fn(async () => { throw new Error('connection refused'); }) });
    const { body, signature } = signed(inbound);
    const res = await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(res.status).toBe(200);
    expect(d.log.error).toHaveBeenCalled();
  });

  it('gives the claim back when handling fails, so the retry is not swallowed', async () => {
    // Without this a crash between claiming and replying loses the message for
    // good: the id is recorded, so Meta's retry is deduped and the customer is
    // never answered at all.
    const d = deps({ sendText: vi.fn(async () => { throw new Error('socket hang up'); }) });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.releaseClaim).toHaveBeenCalledWith('wamid.IN');
    expect(d.markHandled).not.toHaveBeenCalled();
  });

  it('marks a message handled once it is answered', async () => {
    const d = deps();
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.markHandled).toHaveBeenCalledWith('wamid.IN');
    expect(d.releaseClaim).not.toHaveBeenCalled();
  });

  it('stays quiet while a contact is with a human', async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const d = deps({
      getOrCreateContact: vi.fn(async () => ({
        id: 'contact-1', phone: '1', name: null, lead_score: 0,
        stage: 'new', human_handoff: true, handoff_until: until, last_inbound_at: null
      }))
    });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.generateReply).not.toHaveBeenCalled();
    expect(d.sendText).not.toHaveBeenCalled();
    expect(d.markHandled).toHaveBeenCalledWith('wamid.IN');
  });

  it('starts answering again once the handoff window has expired', async () => {
    const expired = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const d = deps({
      getOrCreateContact: vi.fn(async () => ({
        id: 'contact-1', phone: '1', name: null, lead_score: 0,
        stage: 'new', human_handoff: true, handoff_until: expired, last_inbound_at: null
      }))
    });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    expect(d.generateReply).toHaveBeenCalledOnce();
    expect(d.updateLead).toHaveBeenCalledWith('contact-1', expect.any(Number), expect.any(String), false, expired);
  });

  it('decays a stale score instead of stacking on top of it', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const d = deps({
      getOrCreateContact: vi.fn(async () => ({
        id: 'contact-1', phone: '1', name: null, lead_score: 90,
        stage: 'hot', human_handoff: false, handoff_until: null, last_inbound_at: tenDaysAgo
      }))
    });
    const { body, signature } = signed(inbound);
    await post_app(createApp(d), '/webhooks/whatsapp', body, signature);
    await settle();

    const [, score, stage] = d.updateLead.mock.calls[0];
    expect(score).toBeLessThan(90);
    expect(stage).not.toBe('hot');
  });
});
