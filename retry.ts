import type { WhatsAppRetryPolicy } from "./types/config.ts";
import { defaultRetryPredicate } from "./errors/graph_error.ts";

export const DEFAULT_RETRY_POLICY: WhatsAppRetryPolicy = {
  maxAttempts: 3,
  baseMs: 300,
  maxMs: 8_000,
  jitterRatio: 0.25,
  retryPredicate: defaultRetryPredicate,
};

/**
 * Execute `fn` with exponential backoff + jitter.
 *
 * On each failure `policy.retryPredicate` decides whether to retry.
 * If the predicate returns false, or `maxAttempts` is exhausted, the
 * last error is re-thrown.
 *
 * `fn` receives the current attempt number (1-based) so callers can
 * attach it to logs.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: WhatsAppRetryPolicy,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      const shouldRetry = attempt < policy.maxAttempts &&
        policy.retryPredicate(err as { httpStatus?: number; code?: number } | Error);

      if (!shouldRetry) break;

      const delay = computeDelay(attempt, policy, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

function computeDelay(
  attempt: number,
  policy: WhatsAppRetryPolicy,
  err?: unknown,
): number {
  // Honour the server's Retry-After instruction when present (e.g. HTTP 429).
  const retryAfterMs =
    (err !== null &&
      typeof err === "object" &&
      "retryAfterMs" in (err as object))
      ? (err as { retryAfterMs?: number }).retryAfterMs
      : undefined;

  if (typeof retryAfterMs === "number") {
    // Cap at maxMs to protect against absurdly large server-supplied values.
    return Math.min(retryAfterMs, policy.maxMs);
  }

  const exponential = Math.min(
    policy.baseMs * Math.pow(2, attempt - 1),
    policy.maxMs,
  );
  const jitter = exponential * policy.jitterRatio * Math.random();
  return Math.round(exponential + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
