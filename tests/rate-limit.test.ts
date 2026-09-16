import { describe, expect, it } from 'vitest';
import { createLimiter } from '../src/limits/rate-limit.js';

function atClock(start = 0) {
  let current = start;
  return { now: () => current, advance: (ms: number) => { current += ms; } };
}

describe('createLimiter', () => {
  it('allows a burst then blocks the next message from the same contact', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 3, refillMs: 1000, dailyCap: 100, now: clock.now });

    for (let i = 0; i < 3; i++) expect(limiter.allow('a')).toEqual({ ok: true });
    expect(limiter.allow('a')).toEqual({ ok: false, reason: 'burst' });
  });

  it('refills one token per interval', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 2, refillMs: 1000, dailyCap: 100, now: clock.now });

    limiter.allow('a');
    limiter.allow('a');
    expect(limiter.allow('a').ok).toBe(false);

    clock.advance(1000);
    expect(limiter.allow('a')).toEqual({ ok: true });
  });

  it('never refills past the burst size', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 2, refillMs: 1000, dailyCap: 100, now: clock.now });

    limiter.allow('a');
    clock.advance(60_000);
    expect(limiter.allow('a').ok).toBe(true);
    expect(limiter.allow('a').ok).toBe(true);
    expect(limiter.allow('a').ok).toBe(false);
  });

  it('keeps contacts independent, so one spammer does not mute everyone', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 1, refillMs: 1000, dailyCap: 100, now: clock.now });

    expect(limiter.allow('a').ok).toBe(true);
    expect(limiter.allow('a').ok).toBe(false);
    expect(limiter.allow('b').ok).toBe(true);
  });

  it('stops everything at the daily cap', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 100, refillMs: 1000, dailyCap: 3, now: clock.now });

    for (let i = 0; i < 3; i++) expect(limiter.allow(`contact-${i}`).ok).toBe(true);
    expect(limiter.allow('someone-new')).toEqual({ ok: false, reason: 'daily' });
  });

  it('rolls the daily window forward rather than resetting at midnight', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 100, refillMs: 1000, dailyCap: 2, now: clock.now });

    limiter.allow('a');
    limiter.allow('a');
    expect(limiter.allow('a').ok).toBe(false);

    clock.advance(24 * 60 * 60 * 1000 + 1);
    expect(limiter.allow('a').ok).toBe(true);
  });

  it('does not spend the daily budget on a message the burst limit refused', () => {
    const clock = atClock();
    const limiter = createLimiter({ burst: 1, refillMs: 1000, dailyCap: 2, now: clock.now });

    expect(limiter.allow('a').ok).toBe(true);
    expect(limiter.allow('a').ok).toBe(false);
    expect(limiter.allow('a').ok).toBe(false);

    // One reply went out, so one of the two daily slots is left for someone else.
    expect(limiter.allow('b').ok).toBe(true);
    expect(limiter.allow('c')).toEqual({ ok: false, reason: 'daily' });
  });
});
