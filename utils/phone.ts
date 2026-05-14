/**
 * Phone number utilities for WhatsApp Cloud API.
 *
 * The Meta API expects the recipient `to` field to be E.164 digits **without**
 * a leading `+`. These helpers normalize real-world phone strings before send.
 */

/**
 * Normalize a phone number string for use as the `to` field in WhatsApp
 * Cloud API requests.
 *
 * Rules applied (in order):
 *   1. Strip all whitespace.
 *   2. Strip all hyphens and dots used as separators.
 *   3. Strip a leading `+`.
 *   4. Strip a leading `00` international dialing prefix.
 *
 * The function intentionally does **not** add or modify country codes — it
 * only removes formatting characters. Callers are responsible for ensuring
 * a valid country code is present.
 *
 * @throws {Error} if the result contains non-digit characters or is empty.
 *
 * @example
 * normalizeWhatsAppRecipient("+20 100-123-4567") // → "201001234567"
 * normalizeWhatsAppRecipient("00201001234567")   // → "201001234567"
 * normalizeWhatsAppRecipient("201001234567")     // → "201001234567"
 */
export function normalizeWhatsAppRecipient(phoneLike: string): string {
  if (typeof phoneLike !== "string" || phoneLike.trim().length === 0) {
    throw new Error("normalizeWhatsAppRecipient: phone number must be a non-empty string.");
  }

  let normalized = phoneLike
    .replace(/\s+/g, "")    // remove whitespace
    .replace(/[-.()\[\]]/g, "") // remove common separators
    .replace(/^\+/, "")     // strip leading +
    .replace(/^00/, "");    // strip leading 00 (international prefix)

  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `normalizeWhatsAppRecipient: "${phoneLike}" still contains non-digit characters after normalization ("${normalized}"). ` +
        "Ensure a full E.164 number (with country code, without +) is provided.",
    );
  }

  // Soft guard: E.164 numbers are 7–15 digits per ITU-T E.164.
  if (normalized.length < 7 || normalized.length > 15) {
    throw new Error(
      `normalizeWhatsAppRecipient: normalized number "${normalized}" has ${normalized.length} digits ` +
        "(expected 7–15 per E.164).",
    );
  }

  return normalized;
}

/**
 * Attempt normalization without throwing — returns `null` on failure.
 * Useful for validation UIs that want to show an inline error instead of
 * catching an exception.
 */
export function tryNormalizeWhatsAppRecipient(phoneLike: string): string | null {
  try {
    return normalizeWhatsAppRecipient(phoneLike);
  } catch {
    return null;
  }
}
