import { describe, expect, it } from 'vitest';
import { extractIncomingText, extractStatuses } from '../src/channels/whatsapp.js';

const wrap = (value: unknown) => ({ entry: [{ changes: [{ value }] }] });

describe('extractIncomingText', () => {
  it('pulls out a text message with its id', () => {
    const payload = wrap({
      contacts: [{ profile: { name: 'Sam' } }],
      messages: [{ id: 'wamid.ABC', from: '447700900000', type: 'text', text: { body: 'how much' } }]
    });
    expect(extractIncomingText(payload)).toEqual({
      id: 'wamid.ABC',
      from: '447700900000',
      name: 'Sam',
      text: 'how much'
    });
  });

  it('reads a button reply', () => {
    const payload = wrap({
      messages: [{ id: 'wamid.B', from: '1', type: 'button', button: { text: 'Book now' } }]
    });
    expect(extractIncomingText(payload)?.text).toBe('Book now');
  });

  it('reads an interactive list reply', () => {
    const payload = wrap({
      messages: [{
        id: 'wamid.L', from: '1', type: 'interactive',
        interactive: { list_reply: { title: 'Haircut' } }
      }]
    });
    expect(extractIncomingText(payload)?.text).toBe('Haircut');
  });

  it('returns null for a status callback, which carries no message', () => {
    expect(extractIncomingText(wrap({ statuses: [{ id: 'wamid.C', status: 'sent' }] }))).toBeNull();
  });

  it('returns null when the message has no id, since dedup depends on it', () => {
    const payload = wrap({ messages: [{ from: '1', type: 'text', text: { body: 'hi' } }] });
    expect(extractIncomingText(payload)).toBeNull();
  });

  it('survives junk without throwing', () => {
    expect(extractIncomingText(null)).toBeNull();
    expect(extractIncomingText({})).toBeNull();
    expect(extractIncomingText('nonsense')).toBeNull();
  });
});

describe('extractStatuses', () => {
  it('surfaces a failed delivery with its error codes', () => {
    const payload = wrap({
      statuses: [{
        id: 'wamid.D',
        status: 'failed',
        errors: [{ code: 131047, title: 'Re-engagement message' }]
      }]
    });
    expect(extractStatuses(payload)).toEqual([
      { messageId: 'wamid.D', status: 'failed', errorCodes: [131047] }
    ]);
  });

  it('reports a successful delivery with no errors', () => {
    const payload = wrap({ statuses: [{ id: 'wamid.E', status: 'delivered' }] });
    expect(extractStatuses(payload)).toEqual([
      { messageId: 'wamid.E', status: 'delivered', errorCodes: [] }
    ]);
  });

  it('returns an empty list for an ordinary inbound message', () => {
    const payload = wrap({ messages: [{ id: 'x', from: '1', type: 'text', text: { body: 'hi' } }] });
    expect(extractStatuses(payload)).toEqual([]);
  });

  it('survives junk without throwing', () => {
    expect(extractStatuses(null)).toEqual([]);
    expect(extractStatuses({})).toEqual([]);
  });
});
