// ─── Credentials ───────────────────────────────────────────────────────────

/**
 * Credentials required to call the WhatsApp Cloud API on behalf of a single
 * phone number / WABA pair.
 *
 * Host applications are responsible for decrypting the access token before
 * constructing the client. The SDK never reads Deno.env.
 */
export interface WhatsAppCredentials {
  /** Graph API phone-number-id — used for /messages, profile, media, block. */
  phoneNumberId: string;
  /** WhatsApp Business Account ID — used for templates, phone_numbers. */
  businessAccountId: string;
  /** Plain-text Meta access token (Bearer). Caller decrypts before passing. */
  accessToken: string;
}

// ─── Retry policy ──────────────────────────────────────────────────────────

export interface WhatsAppRetryPolicy {
  /** Max total attempts (including the first). Default: 3. */
  maxAttempts: number;
  /** Initial backoff delay in ms. Default: 300. */
  baseMs: number;
  /** Upper cap for any single wait in ms. Default: 8_000. */
  maxMs: number;
  /** Fraction of the computed delay added as random jitter [0, 1]. Default: 0.25. */
  jitterRatio: number;
  /**
   * Return true to retry for a given error.
   * Receives either a parsed WhatsAppGraphError (HTTP-level failure) or a
   * raw Error (network/timeout).
   */
  retryPredicate: (err: { httpStatus?: number; code?: number } | Error) => boolean;
}

// ─── Request hook ──────────────────────────────────────────────────────────

export interface WhatsAppRequestInfo {
  method: string;
  /** Relative Graph path, e.g. "/{phoneNumberId}/messages". */
  path: string;
  bodySize?: number;
}

export type WhatsAppRequestHook = (info: WhatsAppRequestInfo) => void;

// ─── Client options ────────────────────────────────────────────────────────

export interface WhatsAppClientOptions {
  /**
   * Meta Graph API version string, e.g. "v21.0".
   * @default "v21.0"
   */
  graphApiVersion?: string;

  /**
   * Override the Graph base URL. Useful for tests or Meta beta environments.
   * @default "https://graph.facebook.com"
   */
  baseUrl?: string;

  /**
   * Default template language code used when `language` is omitted in
   * template builder helpers.
   * @default "en"
   */
  defaultLanguage?: string;

  /**
   * Inject a custom `fetch` implementation for testing.
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Called before every outgoing HTTP request. Use for tracing/logging.
   * Never receives the access token.
   */
  onRequest?: WhatsAppRequestHook;

  /**
   * Retry policy for transient failures. Pass `null` to disable retries.
   * @default built-in policy (3 attempts, 300 ms base, retries on network errors + 429 + 5xx)
   */
  retryPolicy?: WhatsAppRetryPolicy | null;
}
