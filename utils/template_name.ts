/**
 * Template name and language utilities.
 *
 * These are portable re-implementations of the helpers that exist in
 * `helpers/whatsappService.ts` (Tasker CRM), extracted here so any service
 * that builds or syncs Meta templates can import them without depending on
 * the CRM layer.
 *
 * The CRM's existing helpers remain in place; callers may migrate gradually.
 */

/**
 * Derive the snake_case template name submitted to Meta from a human-readable
 * display name and a unique ID suffix.
 *
 * Rules:
 *   - Lowercase all characters.
 *   - Replace whitespace runs with a single underscore.
 *   - Remove all characters that are not `[a-z0-9_]`.
 *   - Trim leading/trailing underscores.
 *   - If the result is empty, fall back to `tmpl_<last12ofId>`.
 *   - Truncate to 512 characters (Meta limit).
 *
 * This function is the canonical slug used when submitting templates; the
 * same slug must be used when polling Meta for approval status so the
 * name-based match in `crmTemplateMetaSync` stays aligned.
 *
 * @example
 * deriveWhatsAppTemplateSubmissionName("Order Shipped!", "507f1f77bcf86cd799439011")
 * // → "order_shipped"
 */
export function deriveWhatsAppTemplateSubmissionName(
  displayName: string,
  mongoIdHex24: string,
): string {
  const stripped = displayName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "") || "";

  return (stripped.length > 0 ? stripped : `tmpl_${mongoIdHex24.slice(-12)}`)
    .slice(0, 512);
}

/**
 * Normalize a Meta template language code for loose matching.
 *
 * Meta returns `en_US`, `ar`, `en`, etc.  CRM stores just the base tag.
 * This collapses `en_US` → `en`, `ar_SA` → `ar`, etc. so cross-system
 * comparisons don't fail on locale variants.
 *
 * @example
 * normalizeWhatsAppTemplateLanguageCode("en_US") // → "en"
 * normalizeWhatsAppTemplateLanguageCode("AR")    // → "ar"
 */
export function normalizeWhatsAppTemplateLanguageCode(lang: string): string {
  const s = lang.toLowerCase().replace(/-/g, "_");
  const base = s.split("_")[0];
  return base && base.length > 0 ? base : s;
}
