import type { WhatsAppClientOptions, WhatsAppCredentials } from "./types/config.ts";
import type { WhatsAppGraphError, WhatsAppResult } from "./types/graph.ts";
import { parseMetaError, wrapNetworkError } from "./errors/graph_error.ts";
import { DEFAULT_RETRY_POLICY, withRetry } from "./retry.ts";

const DEFAULT_GRAPH_VERSION = "v21.0";
const DEFAULT_BASE_URL = "https://graph.facebook.com";

/**
 * Low-level HTTP client for the WhatsApp Cloud API.
 *
 * All SDK method modules receive an instance of this class and use
 * `request()` / `requestRaw()` to communicate with Meta.
 *
 * This class is the single place where:
 *   - The Graph base URL and version are assembled.
 *   - The Authorization header is injected.
 *   - HTTP errors are normalized into `WhatsAppGraphError`.
 *   - Retries are applied.
 *
 * It is **not** meant to be used directly by application code;
 * use `WhatsAppClient` (the public facade) instead.
 */
export class WhatsAppHttpClient {
  readonly credentials: WhatsAppCredentials;
  private readonly options: Required<
    Pick<WhatsAppClientOptions, "graphApiVersion" | "baseUrl" | "defaultLanguage">
  > & WhatsAppClientOptions;

  constructor(
    credentials: WhatsAppCredentials,
    options: WhatsAppClientOptions = {},
  ) {
    this.credentials = credentials;
    this.options = {
      graphApiVersion: options.graphApiVersion ?? DEFAULT_GRAPH_VERSION,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      defaultLanguage: options.defaultLanguage ?? "en",
      ...options,
    };
  }

  // ─── URL helpers ──────────────────────────────────────────────────────────

  get phoneNumberId(): string {
    return this.credentials.phoneNumberId;
  }

  get businessAccountId(): string {
    return this.credentials.businessAccountId;
  }

  get defaultLanguage(): string {
    return this.options.defaultLanguage;
  }

  /**
   * Build a full Graph API URL.
   * @param path - e.g. `/${phoneNumberId}/messages` (leading slash required)
   * @param query - optional key/value pairs appended as query string
   */
  url(path: string, query?: Record<string, string>): string {
    const base = `${this.options.baseUrl}/${this.options.graphApiVersion}${path}`;
    if (!query || Object.keys(query).length === 0) return base;
    const qs = new URLSearchParams(query).toString();
    return `${base}?${qs}`;
  }

  // ─── Core request ─────────────────────────────────────────────────────────

  /**
   * Execute a JSON-body request and return a typed result union.
   * Retries are applied according to the configured policy.
   */
  async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<WhatsAppResult<T>> {
    const policy = this.options.retryPolicy === null
      ? null
      : (this.options.retryPolicy ?? DEFAULT_RETRY_POLICY);

    const execute = async (attempt: number): Promise<WhatsAppResult<T>> => {
      this.options.onRequest?.({
        method,
        path,
        bodySize: body ? JSON.stringify(body).length : undefined,
      });

      let response: Response;
      try {
        const fetchFn = this.options.fetch ?? globalThis.fetch;
        response = await fetchFn(this.url(path, query), {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.credentials.accessToken}`,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        // Network/transport error — throw so retry wrapper can catch it.
        if (attempt === 1 && !policy) {
          return { ok: false, error: wrapNetworkError(err) };
        }
        throw err;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const retryAfterMs = parseRetryAfterHeader(
          response.headers.get("Retry-After"),
        );
        const error: WhatsAppGraphError = parseMetaError(
          response.status,
          data,
          retryAfterMs,
        );
        // Throw so retry wrapper can evaluate the predicate.
        if (policy && policy.retryPredicate(error)) {
          throw error;
        }
        return { ok: false, error };
      }

      return { ok: true, data: data as T };
    };

    if (!policy) {
      try {
        return await execute(1);
      } catch (err) {
        return { ok: false, error: wrapNetworkError(err) };
      }
    }

    try {
      return await withRetry(execute, policy);
    } catch (err) {
      if (
        err !== null &&
        typeof err === "object" &&
        "httpStatus" in (err as object)
      ) {
        return { ok: false, error: err as WhatsAppGraphError };
      }
      return { ok: false, error: wrapNetworkError(err) };
    }
  }

  /**
   * Execute a multipart/form-data request (used for media upload).
   * No retry on form-data because the FormData body is consumed on first read.
   */
  async requestForm<T>(
    path: string,
    form: FormData,
  ): Promise<WhatsAppResult<T>> {
    this.options.onRequest?.({ method: "POST", path });

    try {
      const fetchFn = this.options.fetch ?? globalThis.fetch;
      const response = await fetchFn(this.url(path), {
        method: "POST",
        headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
        body: form,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, error: parseMetaError(response.status, data) };
      }
      return { ok: true, data: data as T };
    } catch (err) {
      return { ok: false, error: wrapNetworkError(err) };
    }
  }

  /**
   * Fetch a raw binary resource (used for media download).
   * Returns the ArrayBuffer or a WhatsAppGraphError.
   */
  async requestBinary(
    absoluteUrl: string,
  ): Promise<WhatsAppResult<ArrayBuffer>> {
    this.options.onRequest?.({ method: "GET", path: absoluteUrl });

    try {
      const fetchFn = this.options.fetch ?? globalThis.fetch;
      const response = await fetchFn(absoluteUrl, {
        headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { ok: false, error: parseMetaError(response.status, data) };
      }
      return { ok: true, data: await response.arrayBuffer() };
    } catch (err) {
      return { ok: false, error: wrapNetworkError(err) };
    }
  }

  // ─── Convenience shorthands ───────────────────────────────────────────────

  get<T>(path: string, query?: Record<string, string>): Promise<WhatsAppResult<T>> {
    return this.request<T>("GET", path, undefined, query);
  }

  post<T>(path: string, body: Record<string, unknown>): Promise<WhatsAppResult<T>> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body: Record<string, unknown>): Promise<WhatsAppResult<T>> {
    return this.request<T>("PUT", path, body);
  }

  delete<T>(path: string, query?: Record<string, string>, body?: Record<string, unknown>): Promise<WhatsAppResult<T>> {
    return this.request<T>("DELETE", path, body, query);
  }

  // ─── Clone helpers ────────────────────────────────────────────────────────

  /**
   * Return a new client that uses different credentials (same options).
   * Useful when a single service manages multiple WABA numbers.
   */
  withCredentials(credentials: WhatsAppCredentials): WhatsAppHttpClient {
    return new WhatsAppHttpClient(credentials, this.options);
  }

  /**
   * Return a new client with only the phoneNumberId swapped.
   * Convenient when WABA + token are shared across lines.
   */
  withPhoneNumberId(phoneNumberId: string): WhatsAppHttpClient {
    return this.withCredentials({ ...this.credentials, phoneNumberId });
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/**
 * Parse a `Retry-After` header value into milliseconds.
 *
 * Supports both formats defined by RFC 9110:
 *   - Integer seconds: `"30"` → 30_000 ms
 *   - HTTP-date:       `"Fri, 14 May 2026 20:00:00 GMT"` → ms until that date
 *
 * Returns `undefined` when the header is absent or unparseable.
 */
function parseRetryAfterHeader(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header.trim());
  if (!isNaN(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const ms = date - Date.now();
    return ms > 0 ? ms : 0;
  }
  return undefined;
}
