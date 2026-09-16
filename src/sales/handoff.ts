const handoffPatterns = [
  /\b(human|person|real agent|sales rep|representative)\b/i,
  /\b(refund|chargeback|complaint|angry|cancel order)\b/i,
  /\b(legal|lawsuit|fraud)\b/i
];

export function needsHumanHandoff(message: string) {
  return handoffPatterns.some((pattern) => pattern.test(message));
}
