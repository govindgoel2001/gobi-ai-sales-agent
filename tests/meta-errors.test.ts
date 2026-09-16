import { describe, expect, it } from 'vitest';
import {
  describeSendFailure,
  isWindowClosed,
  RE_ENGAGEMENT_WINDOW_CLOSED
} from '../src/channels/meta-errors.js';

describe('isWindowClosed', () => {
  it('recognises the re-engagement code', () => {
    expect(RE_ENGAGEMENT_WINDOW_CLOSED).toBe(131047);
    expect(isWindowClosed(131047)).toBe(true);
  });

  it('does not claim every failure is the window', () => {
    expect(isWindowClosed(131026)).toBe(false);
    expect(isWindowClosed(null)).toBe(false);
  });
});

describe('describeSendFailure', () => {
  it('explains the window in words the owner can act on', () => {
    const text = describeSendFailure(131047, 'Re-engagement message');
    expect(text).toContain('24 hours');
    expect(text.toLowerCase()).toContain('template');
  });

  it('passes through anything it does not recognise instead of guessing', () => {
    expect(describeSendFailure(999999, 'Something new')).toContain('Something new');
  });

  it('copes with no code at all, which is what a network failure looks like', () => {
    expect(describeSendFailure(null, 'network error: fetch failed')).toContain('fetch failed');
  });
});
