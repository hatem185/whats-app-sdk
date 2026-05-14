/**
 * WhatsApp SDK — public entry point.
 *
 * Import the top-level `WhatsAppClient` for all API interactions, or import
 * individual helpers directly from their sub-modules when you need tree-shaking
 * or want to compose your own facade.
 *
 * @example
 * import { WhatsAppClient } from "@WhatsApp/sdk";
 *
 * const wa = new WhatsAppClient({
 *   phoneNumberId:    "1234567890",
 *   businessAccountId: "0987654321",
 *   accessToken:      decryptedToken,
 * });
 *
 * const result = await wa.messages.sendText({ to: "201001234567", body: "Hello!" });
 * if (result.ok) console.log(result.data.messageId);
 */

// ─── Primary facade ───────────────────────────────────────────────────────
export { WhatsAppClient } from "./WhatsAppClient.ts";

// ─── Types (credentials / options) ───────────────────────────────────────
export type {
  WhatsAppClientOptions,
  WhatsAppCredentials,
  WhatsAppRequestHook,
  WhatsAppRequestInfo,
  WhatsAppRetryPolicy,
} from "./types/config.ts";

// ─── Types (Graph API) ────────────────────────────────────────────────────
export type {
  GraphErrorEnvelope,
  GraphErrorPayload,
  GraphListResponse,
  GraphSendResponse,
  WaErrorCode,
  WhatsAppGraphError,
  WhatsAppResult,
} from "./types/graph.ts";
export { WA_ERROR_CODE } from "./types/graph.ts";

// ─── Types (outbound messages) ────────────────────────────────────────────
export type {
  MarkReadParams,
  SendContactsParams,
  SendInteractiveParams,
  SendLocationParams,
  SendMediaByIdParams,
  SendMediaByUrlParams,
  SendMediaParams,
  SendReactionParams,
  SendStickerParams,
  SendTemplateParams,
  SendTextParams,
  SendTypingParams,
  WaContact,
  WaMediaType,
  WaPhoneNumber,
  WaSendResult,
  WaTemplateComponent,
  WaTemplateParam,
} from "./types/messages.ts";

// ─── Types (webhook) ──────────────────────────────────────────────────────
export type {
  ParsedInboundMessage,
  ParsedWebhookEntry,
  WaButtonContent,
  WaContactsContent,
  WaInboundContent,
  WaInboundMessageType,
  WaInteractiveContent,
  WaLocationContent,
  WaMediaContent,
  WaMessageStatus,
  WaOrderContent,
  WaReactionContent,
  WaReferral,
  WaStickerContent,
  WaStatusUpdate,
  WaTextContent,
  WaUnknownContent,
  WebhookVerifyParams,
  WebhookVerifyResult,
} from "./types/webhook.ts";

// ─── Template categories ──────────────────────────────────────────────────
export {
  categoryLabel,
  TEMPLATE_CATEGORY,
  TEMPLATE_CATEGORY_LOWER,
  toMetaCategory,
} from "./template/categories.ts";
export type {
  TemplateCategory,
  TemplateCategoryLower,
} from "./template/categories.ts";

// ─── Template builders ────────────────────────────────────────────────────
export {
  buildAuthTemplatePayload,
  buildMarketingTemplatePayload,
  buildUtilityTemplatePayload,
  sendAuthOtpTemplate,
  sendMarketingTemplate,
  sendUtilityTemplate,
} from "./template/builders.ts";
export type {
  CreateAuthTemplateOptions,
  CreateUtilityTemplateOptions,
  SendAuthOtpTemplateParams,
  SendMarketingTemplateParams,
  SendUtilityTemplateParams,
} from "./template/builders.ts";

// ─── Template validation ──────────────────────────────────────────────────
export {
  assertComponentArity,
  assertOtpCode,
  assertTemplateName,
  countPositionalPlaceholders,
  currencyParam,
  dateTimeParam,
  extractPlaceholderIndices,
  TemplateValidationError,
  textParam,
} from "./template/validate.ts";

// ─── Webhook helpers ──────────────────────────────────────────────────────
export {
  isWhatsAppWebhookPayload,
  parseWebhookEntry,
} from "./webhook/parse.ts";
export {
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "./webhook/verify.ts";

// ─── Error utilities ──────────────────────────────────────────────────────
export {
  defaultRetryPredicate,
  parseMetaError,
  wrapNetworkError,
} from "./errors/graph_error.ts";

// ─── Phone utilities ──────────────────────────────────────────────────────
export {
  normalizeWhatsAppRecipient,
  tryNormalizeWhatsAppRecipient,
} from "./utils/phone.ts";

// ─── Template name / language utilities ──────────────────────────────────
export {
  deriveWhatsAppTemplateSubmissionName,
  normalizeWhatsAppTemplateLanguageCode,
} from "./utils/template_name.ts";

// ─── Method modules (advanced / tree-shakable) ────────────────────────────
export * as messages from "./methods/messages.ts";
export * as media from "./methods/media.ts";
export * as templates from "./methods/templates.ts";
export * as profile from "./methods/profile.ts";
export * as phoneNumbers from "./methods/phone_numbers.ts";
export * as blockUsers from "./methods/block_users.ts";
