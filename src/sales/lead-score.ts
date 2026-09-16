const rules: Array<[RegExp, number]> = [
  [/\b(buy|purchase|order|checkout|pay|book|reserve)\b/i, 25],
  [/\b(price|cost|how much|quote|discount)\b/i, 15],
  [/\b(in stock|available|availability|delivery|shipping)\b/i, 10],
  [/\b(today|now|asap|urgent|immediately)\b/i, 10],
  [/\b(demo|call|meeting|appointment)\b/i, 15]
];

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
