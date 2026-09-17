const handoffPatterns = [
  /\b(human|person|real agent|sales rep|representative)\b/i,
  /\b(refund|chargeback|complaint|angry|cancel order)\b/i,
  /\b(legal|lawsuit|fraud)\b/i
];

export function needsHumanHandoff(message: string) {
  return handoffPatterns.some((pattern) => pattern.test(message));
}

export type HandoffDecision =
  /** Answer normally. */
  | { action: 'reply' }
  /** Newly handed over. Tell the customer once, then go quiet. */
  | { action: 'announce'; until: string }
  /** Already handed over and still inside the window. Say nothing. */
  | { action: 'stay_quiet' };

/**
 * Decides whether the agent should speak.
 *
 * The version this replaced set a boolean that was never cleared, so one
 * customer typing "is there a human there" left the agent answering that
 * contact with the same canned line forever, with no way back short of editing
 * the database. A handoff now expires, and while it is active the agent is
 * silent rather than repeating itself over a human who is trying to talk.
 */
export function decideHandoff(
  message: string,
  handoffUntil: string | null,
  windowHours: number,
  now = new Date()
): HandoffDecision {
  const until = handoffUntil ? new Date(handoffUntil).getTime() : NaN;
  const active = !Number.isNaN(until) && until > now.getTime();

  if (active) return { action: 'stay_quiet' };
  if (!needsHumanHandoff(message)) return { action: 'reply' };

  return {
    action: 'announce',
    until: new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString()
  };
}
