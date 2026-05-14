/**
 * Template categories as defined by the WhatsApp Business API.
 *
 * These are the **Meta-canonical uppercase values** used in:
 *   - `POST /{waba-id}/message_templates` → `category` field
 *   - Meta template status webhooks
 *
 * CRM / product code may use lowercase aliases (see `TEMPLATE_CATEGORY_LOWER`)
 * and convert with `toMetaCategory` when submitting to the API.
 */
export const TEMPLATE_CATEGORY = {
  /**
   * Transactional messages about an ongoing transaction — order updates,
   * shipping alerts, reservation confirmations, account activity, etc.
   * Typically the cheapest tier and subject to the fewest usage restrictions.
   */
  UTILITY: "UTILITY",

  /**
   * Promotional messages — offers, discounts, product announcements.
   * Subject to opt-in requirements and regional marketing rules.
   * Callers are responsible for ensuring subscriber consent.
   */
  MARKETING: "MARKETING",

  /**
   * One-time passcodes and security codes.
   * Uses a dedicated Meta-managed body with optional OTP button types:
   *   - `COPY_CODE` — displays a "Copy Code" button
   *   - `ONE_TAP`   — Android autofill integration
   *   - `ZERO_TAP`  — fully automatic (requires Meta approval)
   */
  AUTHENTICATION: "AUTHENTICATION",
} as const;

export type TemplateCategory =
  (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];

/** Lowercase variants mirroring CRM-internal storage. */
export const TEMPLATE_CATEGORY_LOWER = {
  utility: "utility",
  marketing: "marketing",
  authentication: "authentication",
} as const;

export type TemplateCategoryLower =
  (typeof TEMPLATE_CATEGORY_LOWER)[keyof typeof TEMPLATE_CATEGORY_LOWER];

/**
 * Convert a lowercase or mixed-case category string into the uppercase
 * value required by the Meta template create API.
 */
export function toMetaCategory(category: string): TemplateCategory {
  const upper = category.toUpperCase() as TemplateCategory;
  if (Object.values(TEMPLATE_CATEGORY).includes(upper)) return upper;
  throw new Error(
    `Unknown template category "${category}". ` +
      `Valid values: ${Object.values(TEMPLATE_CATEGORY).join(", ")}`,
  );
}

/**
 * Return a human-friendly label for display in dashboards or logs.
 */
export function categoryLabel(category: TemplateCategory): string {
  const labels: Record<TemplateCategory, string> = {
    UTILITY: "Utility",
    MARKETING: "Marketing",
    AUTHENTICATION: "Authentication / OTP",
  };
  return labels[category] ?? category;
}
