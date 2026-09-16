import crypto from 'node:crypto';
import { config } from '../config.js';

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

export async function sendWhatsAppText(to: string, body: string) {
  const url = `https://graph.facebook.com/${config.META_GRAPH_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
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

  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function extractIncomingText(payload: any) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const from = message.from as string | undefined;
  const type = message.type as string | undefined;
  const profileName = value?.contacts?.[0]?.profile?.name as string | undefined;

  if (!from) return null;

  if (type === 'text') {
    return { from, name: profileName ?? null, text: message.text?.body ?? '' };
  }

  if (type === 'button') {
    return { from, name: profileName ?? null, text: message.button?.text ?? '' };
  }

  if (type === 'interactive') {
    const interactiveText = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '';
    return { from, name: profileName ?? null, text: interactiveText };
  }

  return { from, name: profileName ?? null, text: `[${type ?? 'unsupported'} message]` };
}
