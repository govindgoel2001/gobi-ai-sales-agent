import crypto from 'node:crypto';
import { config } from '../config.js';
import type { IncomingMessage, SendResult, StatusUpdate } from '../types.js';

/**
 * Fails closed, always.
 *
 * The version this replaced returned true when no app secret was set, which
 * meant a deploy with a blank env served a webhook anyone could drive. Config
 * now requires the secret, and this function refuses without it regardless, so
 * neither layer is the only thing standing between a stranger and the agent.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string = config.WHATSAPP_APP_SECRET
) {
  if (!appSecret) return false;
  if (!rawBody || !signatureHeader?.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Returns a result rather than throwing.
 *
 * The caller has to tell "the 24 hour window closed" apart from "the network
 * blipped", because one is a fact to explain to the owner and the other is
 * worth retrying. An exception flattens both into the same thing.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const url = `https://graph.facebook.com/${config.META_GRAPH_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body, preview_url: false }
      })
    });
  } catch (error) {
    return { ok: false, code: null, detail: `network error: ${(error as Error).message}` };
  }

  const text = await res.text();

  if (!res.ok) {
    let code: number | null = null;
    let detail = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as {
        error?: { code?: number; message?: string; error_data?: { details?: string } };
      };
      code = typeof parsed.error?.code === 'number' ? parsed.error.code : null;
      detail = parsed.error?.error_data?.details ?? parsed.error?.message ?? detail;
    } catch {
      // Not JSON. The raw body is the best detail available.
    }
    return { ok: false, code, detail };
  }

  try {
    const parsed = JSON.parse(text) as { messages?: Array<{ id?: string }> };
    return { ok: true, messageId: parsed.messages?.[0]?.id ?? '' };
  } catch {
    return { ok: true, messageId: '' };
  }
}

export function extractIncomingText(payload: unknown): IncomingMessage | null {
  const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const id = message.id as string | undefined;
  const from = message.from as string | undefined;
  const type = message.type as string | undefined;
  const name = (value?.contacts?.[0]?.profile?.name as string | undefined) ?? null;

  // No id means no way to deduplicate a retry, and Meta always sends one.
  if (!id || !from) return null;

  if (type === 'text') return { id, from, name, text: message.text?.body ?? '' };
  if (type === 'button') return { id, from, name, text: message.button?.text ?? '' };
  if (type === 'interactive') {
    const title =
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      '';
    return { id, from, name, text: title };
  }
  return { id, from, name, text: `[${type ?? 'unsupported'} message]` };
}

/**
 * Delivery receipts. The previous version dropped these on the floor, because
 * a status payload has no `messages` array and extraction returned null, so a
 * send that failed after Meta accepted it was invisible.
 */
export function extractStatuses(payload: unknown): StatusUpdate[] {
  const statuses = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (!Array.isArray(statuses)) return [];

  return statuses
    .filter((entry: any) => typeof entry?.id === 'string')
    .map((entry: any) => ({
      messageId: entry.id as string,
      status: (entry.status as string) ?? 'unknown',
      errorCodes: Array.isArray(entry.errors)
        ? entry.errors.map((e: any) => e?.code).filter((c: unknown): c is number => typeof c === 'number')
        : []
    }));
}
