const rules: Array<[RegExp, number]> = [
  [/\b(buy|purchase|order|checkout|pay|book|reserve)\b/i, 25],
  [/\b(price|cost|how much|quote|discount)\b/i, 15],
  [/\b(in stock|available|availability|delivery|shipping)\b/i, 10],
  [/\b(today|now|asap|urgent|immediately)\b/i, 10],
  [/\b(demo|call|meeting|appointment)\b/i, 15]
];

/**
 * How much interest goes stale per day of silence.
 *
 * Without this the score only ever climbs, so anyone who messages enough ends
 * up at 100 and every contact eventually reads as hot. A number that always
 * goes up is not a signal, it is a message counter, and the owner stops
 * trusting the one column that was supposed to tell them who to call.
 */
export const DECAY_PER_DAY = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export function decayScore(current: number, lastInboundAt: string | null, now = new Date()) {
  if (!current || !lastInboundAt) return current;

  const since = new Date(lastInboundAt).getTime();
  if (Number.isNaN(since)) return current;

  const days = (now.getTime() - since) / DAY_MS;
  if (days <= 0) return current;

  return Math.max(0, Math.round(current - days * DECAY_PER_DAY));
}

export function scoreMessage(message: string, current = 0) {
  let score = current;
  for (const [pattern, points] of rules) {
    if (pattern.test(message)) score += points;
  }
  return Math.min(100, score);
}

export function stageFromScore(score: number) {
  if (score >= 75) return 'hot';
  if (score >= 45) return 'warm';
  if (score >= 15) return 'engaged';
  return 'new';
}
