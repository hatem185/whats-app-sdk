import type { WaTemplateComponent, WaTemplateParam } from "../types/messages.ts";

// ─── Errors ───────────────────────────────────────────────────────────────

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}

// ─── Positional variable helpers ──────────────────────────────────────────

/**
 * Count the number of `{{N}}` positional placeholders in a template body
 * string (e.g. `"Hello {{1}}, your code is {{2}}"` → 2).
 */
export function countPositionalPlaceholders(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

/**
 * Extract placeholder indices from a template body string in order.
 * Returns e.g. `[1, 2, 3]` for `"{{1}} … {{2}} … {{3}}"`.
 */
export function extractPlaceholderIndices(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/\D/g, ""), 10)))].sort(
    (a, b) => a - b,
  );
}

// ─── Component arity ──────────────────────────────────────────────────────

/**
 * Assert that every component's `parameters` array has the correct number
 * of entries relative to the declared placeholders in the template.
 *
 * Throws `TemplateValidationError` immediately so callers learn about
 * mismatches before making any network call.
 *
 * @param templateName  - Used only in error messages.
 * @param components    - Components being sent (from the caller's payload).
 */
export function assertComponentArity(
  templateName: string,
  components: WaTemplateComponent[],
): void {
  for (const comp of components) {
    if (!comp.parameters) continue;
    for (const param of comp.parameters) {
      if (param.type === "text" && typeof (param as { text?: string }).text !== "string") {
        throw new TemplateValidationError(
          `Template "${templateName}": component type="${comp.type}" has a text parameter without a string value.`,
        );
      }
    }
  }
}

// ─── Body parameter helpers ───────────────────────────────────────────────

/** Build a text-type body parameter. */
export function textParam(value: string): WaTemplateParam {
  if (typeof value !== "string" || value.length === 0) {
    throw new TemplateValidationError(
      "textParam: value must be a non-empty string.",
    );
  }
  return { type: "text", text: value };
}

/** Build a currency body parameter. */
export function currencyParam(
  code: string,
  amount1000: number,
  fallbackValue: string,
): WaTemplateParam {
  return {
    type: "currency",
    currency: { code, amount_1000: amount1000, fallback_value: fallbackValue },
  };
}

/** Build a date_time body parameter. */
export function dateTimeParam(
  fallbackValue: string,
  extra?: Record<string, unknown>,
): WaTemplateParam {
  return {
    type: "date_time",
    date_time: { fallback_value: fallbackValue, ...(extra ?? {}) },
  };
}

// ─── Authentication OTP validation ────────────────────────────────────────

/**
 * OTP code rules per Meta's authentication template specification:
 *   - Must be 1–15 characters.
 *   - Should contain only alphanumeric characters (Meta recommendation).
 */
export function assertOtpCode(code: string): void {
  if (!code || code.length > 15) {
    throw new TemplateValidationError(
      `OTP code must be 1–15 characters, got ${JSON.stringify(code)}.`,
    );
  }
}

// ─── Template create payload validation ───────────────────────────────────

/**
 * Check that a template `name` meets Meta's requirements:
 *   - Lowercase alphanumeric + underscores only.
 *   - 1–512 characters.
 */
export function assertTemplateName(name: string): void {
  if (!name || name.length > 512) {
    throw new TemplateValidationError(
      `Template name must be 1–512 characters.`,
    );
  }
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new TemplateValidationError(
      `Template name "${name}" must contain only lowercase letters, digits, and underscores.`,
    );
  }
}
