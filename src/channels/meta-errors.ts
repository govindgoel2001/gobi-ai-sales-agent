/**
 * Meta error codes we act on by name.
 *
 * 131047, "Re-engagement message", is the one that matters most: a free-form
 * message can only be sent inside 24 hours of the customer's last inbound
 * message, and outside that window the only way through is an approved
 * template. It arrives two ways, as an error on the send response and as a
 * failed delivery receipt in the statuses webhook, so both paths classify
 * through here.
 *
 * Source: developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const RE_ENGAGEMENT_WINDOW_CLOSED = 131047;

const WINDOW_CLOSED = new Set<number>([RE_ENGAGEMENT_WINDOW_CLOSED]);

export function isWindowClosed(code: number | null): boolean {
  return code !== null && WINDOW_CLOSED.has(code);
}

export function describeSendFailure(code: number | null, detail: string): string {
  if (isWindowClosed(code)) {
    return (
      `WhatsApp refused the message because more than 24 hours have passed since this ` +
      `person last wrote to you. Free-form replies only work inside that window. To reopen ` +
      `the conversation you need an approved message template. (code ${code}: ${detail})`
    );
  }
  return `WhatsApp refused the message. (code ${code ?? 'none'}: ${detail})`;
}
