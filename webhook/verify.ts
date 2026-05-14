import { createHmac } from "node:crypto";
import type {
  WebhookVerifyParams,
  WebhookVerifyResult,
} from "../types/webhook.ts";

/**
 * Validate a Meta webhook verification GET request.
 *
 * Meta sends three query parameters when it wants to confirm your endpoint:
 *   - `hub.mode`         must equal `"subscribe"`
 *   - `hub.verify_token` must match the secret you registered
 *   - `hub.challenge`    an opaque string you must echo back as plain text
 *
 * @example
 * // In your HTTP handler (Oak, Fresh, Hono, etc.):
 * const result = verifyWebhookChallenge(
 *   {
 *     mode:        url.searchParams.get("hub.mode"),
 *     verifyToken: url.searchParams.get("hub.verify_token"),
 *     challenge:   url.searchParams.get("hub.challenge"),
 *   },
 *   storedVerifyToken,
 * );
 * if (result.ok) {
 *   return new Response(result.challenge, { status: 200 });
 * } else {
 *   return new Response(result.reason, { status: 403 });
 * }
 */
export function verifyWebhookChallenge(
  params: WebhookVerifyParams,
  compareToken: string,
): WebhookVerifyResult {
  if (params.mode !== "subscribe") {
    return {
      ok: false,
      reason: `hub.mode must be "subscribe", got ${JSON.stringify(params.mode)}`,
    };
  }
  if (!params.verifyToken) {
    return { ok: false, reason: "hub.verify_token is missing" };
  }
  if (!params.challenge) {
    return { ok: false, reason: "hub.challenge is missing" };
  }
  if (params.verifyToken !== compareToken) {
    return { ok: false, reason: "hub.verify_token mismatch" };
  }
  return { ok: true, challenge: params.challenge };
}

/**
 * Verify the `x-hub-signature-256` header on an inbound POST from Meta.
 *
 * Meta signs the raw request body with your app secret using HMAC-SHA256 and
 * attaches the result as `sha256=<hex>` in the header. This function
 * recomputes the HMAC and performs a constant-time comparison.
 *
 * @param rawBody  - The raw request body string (do NOT parse/re-serialize).
 * @param signature - Value of the `x-hub-signature-256` header (may be null).
 * @param appSecret - Your Meta app secret (plain text).
 *
 * @returns `true` if the signature matches; `false` otherwise.
 *
 * @example
 * const valid = verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
 * if (!valid) return new Response("Unauthorized", { status: 401 });
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature) return false;
  const expected = "sha256=" +
    createHmac("sha256", appSecret).update(rawBody).digest("hex");
  // Constant-time comparison to prevent timing attacks.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
