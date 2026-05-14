// ─── Shared ────────────────────────────────────────────────────────────────

/** Recipient phone number (E.164 digits, no leading +). */
export type WaPhoneNumber = string;

/** Optional context linking a send to a prior message (quoted reply). */
export interface WaMessageContext {
  message_id: string;
}

// ─── Text ──────────────────────────────────────────────────────────────────

export interface SendTextParams {
  to: WaPhoneNumber;
  body: string;
  /** Render an inline URL preview card. @default false */
  previewUrl?: boolean;
  /** Makes this a quoted reply inside a conversation. */
  replyToMessageId?: string;
}

// ─── Media ─────────────────────────────────────────────────────────────────

export type WaMediaType = "image" | "video" | "audio" | "document";

interface SendMediaBase {
  to: WaPhoneNumber;
  type: WaMediaType;
  caption?: string;
  /** Only for `document` type. */
  filename?: string;
  replyToMessageId?: string;
}

export interface SendMediaByUrlParams extends SendMediaBase {
  link: string;
}

export interface SendMediaByIdParams extends SendMediaBase {
  mediaId: string;
}

export type SendMediaParams = SendMediaByUrlParams | SendMediaByIdParams;

// ─── Sticker ───────────────────────────────────────────────────────────────

export interface SendStickerParams {
  to: WaPhoneNumber;
  /** Provide exactly one of `link` or `mediaId`. */
  link?: string;
  mediaId?: string;
  replyToMessageId?: string;
}

// ─── Reaction ──────────────────────────────────────────────────────────────

export interface SendReactionParams {
  to: WaPhoneNumber;
  /** WAMID of the message to react to. */
  messageId: string;
  /** Unicode emoji. Pass empty string `""` to remove reaction. */
  emoji: string;
}

// ─── Location ──────────────────────────────────────────────────────────────

export interface SendLocationParams {
  to: WaPhoneNumber;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  replyToMessageId?: string;
}

// ─── Contacts ──────────────────────────────────────────────────────────────

export interface SendContactsParams {
  to: WaPhoneNumber;
  contacts: WaContact[];
  replyToMessageId?: string;
}

export interface WaContact {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    prefix?: string;
  };
  phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
  emails?: Array<{ email: string; type?: string }>;
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    country_code?: string;
    type?: string;
  }>;
  urls?: Array<{ url: string; type?: string }>;
  org?: { company?: string; department?: string; title?: string };
  birthday?: string;
}

// ─── Interactive ───────────────────────────────────────────────────────────

export interface SendInteractiveParams {
  to: WaPhoneNumber;
  /** Full Cloud API interactive object — callers compose this themselves for full flexibility. */
  interactive: Record<string, unknown>;
  replyToMessageId?: string;
}

// ─── Template ──────────────────────────────────────────────────────────────

/** A single component parameter (text, currency, date_time, image, document). */
export type WaTemplateParam =
  | { type: "text"; text: string }
  | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: "date_time"; date_time: { fallback_value: string; [k: string]: unknown } }
  | { type: "image"; image: { link?: string; id?: string } }
  | { type: "document"; document: { link?: string; id?: string; filename?: string } }
  | { type: "video"; video: { link?: string; id?: string } }
  | { type: "payload"; payload: string }
  | { type: "action"; action: Record<string, unknown> };

/** A resolved template component with its parameters. */
export interface WaTemplateComponent {
  type: "header" | "body" | "button" | "footer";
  sub_type?: "quick_reply" | "url" | "otp";
  index?: number;
  parameters?: WaTemplateParam[];
}

export interface SendTemplateParams {
  to: WaPhoneNumber;
  templateName: string;
  language: string;
  components?: WaTemplateComponent[];
  replyToMessageId?: string;
}

// ─── Mark-read / Typing ────────────────────────────────────────────────────

export interface MarkReadParams {
  messageId: string;
}

export interface SendTypingParams {
  /** WAMID of the incoming message that triggered the typing event. */
  messageId: string;
}

// ─── Send result ───────────────────────────────────────────────────────────

export interface WaSendResult {
  /** Meta WAMID, e.g. "wamid.XXXXX". */
  messageId: string;
  /** Canonical recipient WA ID as returned by Meta. */
  waId?: string;
}
