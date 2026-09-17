import { describe, expect, it } from 'vitest';
import { decayScore, scoreMessage, stageFromScore } from '../src/sales/lead-score.js';

describe('scoreMessage', () => {
  it('scores buying intent higher than browsing', () => {
    expect(scoreMessage('I want to buy one today')).toBeGreaterThan(scoreMessage('how much is it'));
  });

  it('never exceeds 100', () => {
    expect(scoreMessage('buy price available today demo', 90)).toBe(100);
  });

  it('leaves an unrelated message alone', () => {
    expect(scoreMessage('thanks', 20)).toBe(20);
  });
});

describe('decayScore', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

  it('barely touches a score from an hour ago', () => {
    expect(decayScore(80, hoursAgo(1), now)).toBe(80);
  });

  it('takes ten points off per day of silence', () => {
    expect(decayScore(80, hoursAgo(24), now)).toBe(70);
    expect(decayScore(80, hoursAgo(48), now)).toBe(60);
  });

  it('cools a hot lead out of hot after long enough', () => {
    const cooled = decayScore(80, hoursAgo(24 * 5), now);
    expect(stageFromScore(cooled)).not.toBe('hot');
  });

  it('never goes below zero', () => {
    expect(decayScore(20, hoursAgo(24 * 30), now)).toBe(0);
  });

  it('copes with a contact that has never written in', () => {
    expect(decayScore(50, null, now)).toBe(50);
  });

  it('ignores an unparseable timestamp rather than zeroing the score', () => {
    expect(decayScore(50, 'not a date', now)).toBe(50);
  });

  it('does not inflate a score when clocks disagree', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    expect(decayScore(50, future, now)).toBe(50);
  });
});
