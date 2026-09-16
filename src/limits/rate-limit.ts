export type LimitDecision = { ok: true } | { ok: false; reason: 'burst' | 'daily' };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Two guards over one counter.
 *
 * The per-contact bucket stops one person holding a conversation faster than a
 * person can type. The daily cap is the backstop that bounds the bill no matter
 * how many contacts are involved, which is the case a per-contact limit cannot
 * see.
 *
 * In memory on purpose. A restart forgives everyone, which is the right failure
 * for a guard whose job is to bound a bill rather than to enforce a quota, and
 * it keeps the hot path off the database.
 */
export function createLimiter({
  burst,
  refillMs,
  dailyCap,
  now = () => Date.now()
}: {
  burst: number;
  refillMs: number;
  dailyCap: number;
  now?: () => number;
}) {
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();
  let dayStarted = now();
  let dayCount = 0;

  return {
    allow(contactId: string): LimitDecision {
      const at = now();

      if (at - dayStarted >= DAY_MS) {
        dayStarted = at;
        dayCount = 0;
      }
      if (dayCount >= dailyCap) return { ok: false, reason: 'daily' };

      const bucket = buckets.get(contactId) ?? { tokens: burst, lastRefill: at };
      const refills = Math.floor((at - bucket.lastRefill) / refillMs);
      if (refills > 0) {
        bucket.tokens = Math.min(burst, bucket.tokens + refills);
        bucket.lastRefill += refills * refillMs;
      }

      // Checked after the daily cap but counted before it: a message the burst
      // limit refuses never happened, so it must not spend a daily slot.
      if (bucket.tokens <= 0) {
        buckets.set(contactId, bucket);
        return { ok: false, reason: 'burst' };
      }

      bucket.tokens -= 1;
      buckets.set(contactId, bucket);
      dayCount += 1;
      return { ok: true };
    }
  };
}
