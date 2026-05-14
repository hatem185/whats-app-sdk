/**
 * High-level template builders.
 *
 * Each builder produces a ready-to-use `SendTemplateParams` (for `sendTemplate`)
 * or a `CreateTemplatePayload` (for `createTemplate`), reducing boilerplate for
 * the three Meta template categories.
 *
 * All builders validate their inputs and throw `TemplateValidationError`
 * before any network call is made.
 */
import type { WhatsAppHttpClient } from "../client.ts";
import type { SendTemplateParams, WaTemplateComponent } from "../types/messages.ts";
import type { WhatsAppResult } from "../types/graph.ts";
import type { WaSendResult } from "../types/messages.ts";
import type { CreateTemplatePayload } from "../methods/templates.ts";
import { sendTemplate } from "../methods/messages.ts";
import { TEMPLATE_CATEGORY } from "./categories.ts";
import { assertOtpCode, assertTemplateName, textParam } from "./validate.ts";

// ─── Utility ─────────────────────────────────────────────────────────────

export interface SendUtilityTemplateParams {
  to: string;
  templateName: string;
  language: string;
  /**
   * Positional `{{N}}` body parameters in order.
   * Each string becomes a `{ type: "text", text: value }` parameter.
   */
  bodyParams?: string[];
  /**
   * Positional header parameters (e.g. for image/text headers).
   */
  headerParams?: WaTemplateComponent["parameters"];
  /**
   * Button parameters (e.g. dynamic URL suffix for `url` buttons).
   */
  buttonParams?: Array<{ index: number; params: WaTemplateComponent["parameters"] }>;
  replyToMessageId?: string;
}

/**
 * Send a **Utility** template message.
 *
 * Utility templates are for transactional notifications — order updates,
 * appointment reminders, shipping alerts, etc.
 *
 * @example
 * await sendUtilityTemplate(http, {
 *   to: "201001234567",
 *   templateName: "order_shipped",
 *   language: "en",
 *   bodyParams: ["ORD-9821", "2 days"],
 * });
 */
export function sendUtilityTemplate(
  http: WhatsAppHttpClient,
  params: SendUtilityTemplateParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return sendCategoryTemplate(http, params);
}

// ─── Marketing ────────────────────────────────────────────────────────────

export interface SendMarketingTemplateParams extends SendUtilityTemplateParams {
  /**
   * Reminder: callers must ensure the recipient has opted in to marketing
   * messages in compliance with applicable law and Meta policies.
   * The SDK does not enforce this.
   */
  _optInConfirmed?: true;
}

/**
 * Send a **Marketing** template message.
 *
 * Marketing templates include promotions, discounts, and product launches.
 * Subscriber opt-in and regional compliance are the caller's responsibility.
 *
 * @example
 * await sendMarketingTemplate(http, {
 *   to: "201001234567",
 *   templateName: "summer_sale_2026",
 *   language: "ar",
 *   bodyParams: ["30%"],
 * });
 */
export function sendMarketingTemplate(
  http: WhatsAppHttpClient,
  params: SendMarketingTemplateParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return sendCategoryTemplate(http, params);
}

// ─── Authentication / OTP ─────────────────────────────────────────────────

export interface SendAuthOtpTemplateParams {
  to: string;
  templateName: string;
  language: string;
  /** The one-time code to inject into the template body. Max 15 characters. */
  otpCode: string;
  replyToMessageId?: string;
}

/**
 * Send an **Authentication** (OTP) template message.
 *
 * Authentication templates use a Meta-managed body structure. The only
 * variable the caller supplies is the OTP code itself — Meta enforces the
 * remaining template text at approval time.
 *
 * Template must have been created with `category: "AUTHENTICATION"` and
 * approved before sending.
 *
 * Supports both `COPY_CODE` and `ONE_TAP` button templates — the button
 * parameter is inferred from the code position.
 *
 * @example
 * await sendAuthOtpTemplate(http, {
 *   to: "201001234567",
 *   templateName: "verify_code",
 *   language: "en",
 *   otpCode: "847213",
 * });
 */
export function sendAuthOtpTemplate(
  http: WhatsAppHttpClient,
  params: SendAuthOtpTemplateParams,
): Promise<WhatsAppResult<WaSendResult>> {
  assertOtpCode(params.otpCode);

  const components: WaTemplateComponent[] = [
    {
      type: "body",
      parameters: [textParam(params.otpCode)],
    },
    // Button index 0 — OTP autofill / copy-code button receives the code.
    {
      type: "button",
      sub_type: "otp",
      index: 0,
      parameters: [{ type: "payload", payload: params.otpCode }],
    },
  ];

  const sendParams: SendTemplateParams = {
    to: params.to,
    templateName: params.templateName,
    language: params.language,
    components,
    replyToMessageId: params.replyToMessageId,
  };

  return sendTemplate(http, sendParams);
}

// ─── Create payload builders ──────────────────────────────────────────────

export interface CreateUtilityTemplateOptions {
  /** Snake-case, lowercase, no spaces. */
  name: string;
  language: string;
  /** Template body text with `{{1}}` … `{{N}}` placeholders. */
  bodyText: string;
  /** Optional header text (plain text, max 60 chars). */
  headerText?: string;
  /** Optional footer text (max 60 chars). */
  footerText?: string;
  /** Quick-reply or URL buttons. */
  buttons?: Array<Record<string, unknown>>;
  /** Example values for each placeholder — helps Meta's approval review. */
  bodyExamples?: string[];
}

/**
 * Build a `CreateTemplatePayload` for a **Utility** template.
 * Pass the result directly to `createTemplate(http, payload)`.
 */
export function buildUtilityTemplatePayload(
  opts: CreateUtilityTemplateOptions,
): CreateTemplatePayload {
  assertTemplateName(opts.name);
  return buildTextTemplatePayload(opts, TEMPLATE_CATEGORY.UTILITY);
}

/**
 * Build a `CreateTemplatePayload` for a **Marketing** template.
 * Pass the result directly to `createTemplate(http, payload)`.
 */
export function buildMarketingTemplatePayload(
  opts: CreateUtilityTemplateOptions,
): CreateTemplatePayload {
  assertTemplateName(opts.name);
  return buildTextTemplatePayload(opts, TEMPLATE_CATEGORY.MARKETING);
}

export interface CreateAuthTemplateOptions {
  name: string;
  language: string;
  /**
   * Type of OTP button:
   *   - `COPY_CODE` — shows a "Copy Code" button (default)
   *   - `ONE_TAP`   — Android autofill; requires `packageName` + `signatureHash`
   */
  otpType: "COPY_CODE" | "ONE_TAP";
  /** Button label text. @default "Copy Code" */
  buttonText?: string;
  /** Add Meta's standard security recommendation to the body. @default true */
  addSecurityRecommendation?: boolean;
  /** How many minutes until the code expires (shown in footer). @default 10 */
  codeExpirationMinutes?: number;
  /** Required when `otpType === "ONE_TAP"`. Your Android app package name. */
  packageName?: string;
  /** Required when `otpType === "ONE_TAP"`. Your app's signing key hash. */
  signatureHash?: string;
}

/**
 * Build a `CreateTemplatePayload` for an **Authentication** (OTP) template.
 *
 * Matches the structures shown in the Postman collection:
 *   - *Create authentication template w/ OTP copy code button*
 *   - *Create authentication template w/ OTP one-tap autofill button*
 *
 * Pass the result to `createTemplate(http, payload)`.
 */
export function buildAuthTemplatePayload(
  opts: CreateAuthTemplateOptions,
): CreateTemplatePayload {
  assertTemplateName(opts.name);

  const button: Record<string, unknown> = {
    type: "OTP",
    otp_type: opts.otpType,
    text: opts.buttonText ?? "Copy Code",
  };

  if (opts.otpType === "ONE_TAP") {
    if (!opts.packageName || !opts.signatureHash) {
      throw new Error(
        "ONE_TAP authentication templates require `packageName` and `signatureHash`.",
      );
    }
    button.autofill_text = "Autofill";
    button.package_name = opts.packageName;
    button.signature_hash = opts.signatureHash;
  }

  const components: Array<Record<string, unknown>> = [
    {
      type: "BODY",
      add_security_recommendation: opts.addSecurityRecommendation ?? true,
    },
    {
      type: "FOOTER",
      code_expiration_minutes: opts.codeExpirationMinutes ?? 10,
    },
    {
      type: "BUTTONS",
      buttons: [button],
    },
  ];

  return {
    name: opts.name,
    language: opts.language,
    category: TEMPLATE_CATEGORY.AUTHENTICATION,
    components,
  };
}

// ─── Shared helper ────────────────────────────────────────────────────────

function buildTextTemplatePayload(
  opts: CreateUtilityTemplateOptions,
  category: "UTILITY" | "MARKETING",
): CreateTemplatePayload {
  const components: Array<Record<string, unknown>> = [];

  if (opts.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: opts.headerText });
  }

  const bodyComp: Record<string, unknown> = {
    type: "BODY",
    text: opts.bodyText,
  };
  if (opts.bodyExamples && opts.bodyExamples.length > 0) {
    bodyComp.example = { body_text: [opts.bodyExamples] };
  }
  components.push(bodyComp);

  if (opts.footerText) {
    components.push({ type: "FOOTER", text: opts.footerText });
  }

  if (opts.buttons && opts.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: opts.buttons });
  }

  return {
    name: opts.name,
    language: opts.language,
    category,
    components,
  };
}

// ─── Shared (private) send helper ─────────────────────────────────────────

function sendCategoryTemplate(
  http: WhatsAppHttpClient,
  params: SendUtilityTemplateParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const components: WaTemplateComponent[] = [];

  if (params.headerParams && params.headerParams.length > 0) {
    components.push({ type: "header", parameters: params.headerParams });
  }

  if (params.bodyParams && params.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParams.map((v) => textParam(v)),
    });
  }

  if (params.buttonParams) {
    for (const btn of params.buttonParams) {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: btn.index,
        parameters: btn.params,
      });
    }
  }

  return sendTemplate(http, {
    to: params.to,
    templateName: params.templateName,
    language: params.language,
    components: components.length > 0 ? components : undefined,
    replyToMessageId: params.replyToMessageId,
  });
}
