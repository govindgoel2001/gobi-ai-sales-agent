import { describe, expect, it } from 'vitest';
import { safeParse } from '../src/voice/twilio-realtime.js';

describe('safeParse', () => {
  it('parses a normal frame', () => {
    expect(safeParse<{ event: string }>('{"event":"start"}')).toEqual({ event: 'start' });
  });

  it('parses a buffer frame, which is what ws actually delivers', () => {
    expect(safeParse(Buffer.from('{"event":"media"}'))).toEqual({ event: 'media' });
  });

  it('returns null on a truncated frame instead of throwing', () => {
    expect(safeParse('{"event":')).toBeNull();
  });

  it('returns null on a binary frame', () => {
    expect(safeParse(Buffer.from([0xff, 0xfe, 0x00]))).toBeNull();
  });

  it('returns null on a frame that is valid json but not an object', () => {
    expect(safeParse('"just a string"')).toBeNull();
    expect(safeParse('42')).toBeNull();
    expect(safeParse('null')).toBeNull();
  });
});
