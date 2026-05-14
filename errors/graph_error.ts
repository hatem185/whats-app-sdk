import type {
  GraphErrorEnvelope,
  GraphErrorPayload,
  WhatsAppGraphError,
} from "../types/graph.ts";

/**
 * Parse a Meta Graph API error response body into a structured
 * `WhatsAppGraphError`. Always returns a valid error object — if the
 * body is malformed it synthesizes a message from the HTTP status.
 *
 * @param httpStatus    - HTTP status code from the fetch response.
 * @param body          - Parsed JSON from the response body (or raw text).
 * @param retryAfterMs  - Optional delay parsed from the `Retry-After` header.
 */
export function parseMetaError(
  httpStatus: number,
  body: unknown,
  retryAfterMs?: number,
): WhatsAppGraphError {
  const envelope = body as Partial<GraphErrorEnvelope>;
  const payload = envelope?.error as Partial<GraphErrorPayload> | undefined;

  return {
    httpStatus,
    message: payload?.message ?? `WhatsApp API error — HTTP ${httpStatus}`,
    code: typeof payload?.code === "number" ? payload.code : undefined,
    errorSubcode: typeof payload?.error_subcode === "number"
      ? payload.error_subcode
      : undefined,
    type: typeof payload?.type === "string" ? payload.type : undefined,
    fbtraceId: typeof payload?.fbtrace_id === "string"
      ? payload.fbtrace_id
      : undefined,
    raw: payload as GraphErrorPayload | undefined,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

/**
 * Wrap a caught network/transport Error into a WhatsAppGraphError shape
 * so all SDK methods can return a single error type.
 */
export function wrapNetworkError(err: unknown): WhatsAppGraphError {
  const message = err instanceof Error
    ? err.message
    : "Unknown network error";
  return { httpStatus: 0, message };
}

/**
 * Determine whether a given error warrants a retry based on the
 * default SDK policy:
 *   - httpStatus 0 → network/timeout errors → retry
 *   - httpStatus 429 → rate limit → retry (caller should honour Retry-After)
 *   - httpStatus 408 → request timeout → retry
 *   - httpStatus 502 / 503 / 504 → transient upstream → retry
 *   - everything else → do not retry
 *
 * Applications can override this via `WhatsAppClientOptions.retryPolicy.retryPredicate`.
 */
export function defaultRetryPredicate(
  err: { httpStatus?: number; code?: number } | Error,
): boolean {
  if (err instanceof Error) return true; // network/fetch level failure
  const status = (err as { httpStatus?: number }).httpStatus ?? 0;
  if (status === 0) return true;
  return status === 408 || status === 429 || status === 502 ||
    status === 503 || status === 504;
}
