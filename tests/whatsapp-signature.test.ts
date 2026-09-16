import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from '../src/channels/whatsapp.js';

const secret = 'a'.repeat(32);
const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
const sign = (buf: Buffer, key: string) =>
  'sha256=' + crypto.createHmac('sha256', key).update(buf).digest('hex');

describe('verifyMetaSignature', () => {
  it('accepts a correctly signed body', () => {
    expect(verifyMetaSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it('rejects a body signed with a different secret', () => {
    expect(verifyMetaSignature(body, sign(body, 'b'.repeat(32)), secret)).toBe(false);
  });

  it('rejects a body that was altered after signing', () => {
    const signature = sign(body, secret);
    expect(verifyMetaSignature(Buffer.from('{"object":"tampered"}'), signature, secret)).toBe(false);
  });

  it('fails closed when no secret is configured', () => {
    expect(verifyMetaSignature(body, sign(body, secret), '')).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
  });

  it('rejects a header without the sha256 prefix', () => {
    const bare = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyMetaSignature(body, bare, secret)).toBe(false);
  });

  it('rejects a missing body', () => {
    expect(verifyMetaSignature(undefined, sign(body, secret), secret)).toBe(false);
  });
});
