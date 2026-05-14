// ─── Graph success shapes ──────────────────────────────────────────────────

/** Standard envelope returned by /{phone-number-id}/messages on success. */
export interface GraphSendResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

/** Standard envelope returned by paginated WABA list endpoints. */
export interface GraphListResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

// ─── Graph error shapes ────────────────────────────────────────────────────

/** Raw error object exactly as returned by the Graph API. */
export interface GraphErrorPayload {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_data?: string;
  fbtrace_id?: string;
}

/** Wrapper envelope: `{ error: GraphErrorPayload }` */
export interface GraphErrorEnvelope {
  error: GraphErrorPayload;
}

// ─── SDK-normalized error ──────────────────────────────────────────────────

/**
 * Structured error returned by every SDK method on failure.
 * Contains enough information to:
 *   - Show a human-readable `message` to developers.
 *   - Branch on machine-readable `code` / `errorSubcode` (e.g. 131047).
 *   - Trace failures via `fbtraceId` in Meta support requests.
 */
export interface WhatsAppGraphError {
  /** HTTP status code from the Graph response. */
  httpStatus: number;
  /** Human-readable description (from `error.message` or synthesized). */
  message: string;
  /** Graph error.code, e.g. 100, 131047. */
  code?: number;
  /** Graph error.error_subcode. */
  errorSubcode?: number;
  /** Graph error.type, e.g. "OAuthException". */
  type?: string;
  /** Graph fbtrace_id for Meta support. */
  fbtraceId?: string;
  /** Verbatim raw error payload for forensic logging (strip tokens upstream). */
  raw?: GraphErrorPayload;
  /**
   * When the server returned a `Retry-After` header (common on HTTP 429),
   * this is the parsed delay in **milliseconds** the retry logic should wait
   * before the next attempt.
   */
  retryAfterMs?: number;
}

// ─── SDK result union ──────────────────────────────────────────────────────

export type WhatsAppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WhatsAppGraphError };

// ─── Known error codes (reference) ────────────────────────────────────────

/**
 * A non-exhaustive catalogue of meaningful Graph error codes.
 * Use these constants in `retryPredicate` or UI messaging instead of
 * hard-coding magic numbers.
 *
 * Source: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const WA_ERROR_CODE = {
  /** Re-engagement message outside the 24-hour customer care window. */
  OUTSIDE_CUSTOMER_CARE_WINDOW: 131047,
  /** Template does not exist or is not approved for this WABA. */
  TEMPLATE_NOT_APPROVED: 132001,
  /** Template parameter count mismatch. */
  TEMPLATE_PARAMETER_COUNT_MISMATCH: 132012,
  /** Template text too long. */
  TEMPLATE_TEXT_TOO_LONG: 132013,
  /** Template format character mismatch. */
  TEMPLATE_FORMAT_MISMATCH: 132014,
  /** Message failed to send because there are restrictions on how many messages can be sent from this phone number. */
  PHONE_NUMBER_NOT_ALLOWED: 131031,
  /** Recipient phone number not on WhatsApp. */
  RECIPIENT_NOT_ON_WHATSAPP: 131026,
  /** Rate limit hit. */
  RATE_LIMIT: 130429,
  /** Spam rate limit. */
  SPAM_RATE_LIMIT: 131048,
} as const;

export type WaErrorCode = (typeof WA_ERROR_CODE)[keyof typeof WA_ERROR_CODE];
