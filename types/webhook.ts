// ─── Parsed inbound message ────────────────────────────────────────────────

/** High-level inbound message after normalization. */
export interface ParsedInboundMessage {
  /** Sender's WA phone number (no +). */
  from: string;
  /** WAMID assigned by Meta. */
  messageId: string;
  timestamp: string;
  type: WaInboundMessageType;
  content: WaInboundContent;
  /** WhatsApp display name of the sender (when available). */
  profileName?: string;
  /** Set when the sender replied to a prior message. */
  context?: { from: string; id: string };
}

export type WaInboundMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "reaction"
  | "button"
  | "order"
  | "system"
  | "unknown";

// ─── Inbound content per type ──────────────────────────────────────────────

export type WaInboundContent =
  | WaTextContent
  | WaMediaContent
  | WaStickerContent
  | WaLocationContent
  | WaContactsContent
  | WaInteractiveContent
  | WaReactionContent
  | WaButtonContent
  | WaOrderContent
  | WaUnknownContent;

export interface WaTextContent {
  type: "text";
  text: string;
  /** Present when the message originated from a Click-to-WhatsApp ad. */
  referral?: WaReferral;
}

export interface WaMediaContent {
  type: "image" | "video" | "audio" | "document";
  mediaId: string;
  mimeType?: string;
  caption?: string;
  fileName?: string;
  isVoice?: boolean;
}

export interface WaStickerContent {
  type: "sticker";
  mediaId: string;
  mimeType?: string;
}

export interface WaLocationContent {
  type: "location";
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}

export interface WaContactsContent {
  type: "contacts";
  contacts: Array<Record<string, unknown>>;
}

export interface WaInteractiveContent {
  type: "interactive";
  interactiveType?: string;
  buttonReply?: { id: string; title: string };
  listReply?: { id: string; title: string };
}

export interface WaReactionContent {
  type: "reaction";
  emoji: string;
  /** WAMID of the message that was reacted to. */
  messageId: string;
}

/** Quick-reply button click from a template message. */
export interface WaButtonContent {
  type: "button";
  text: string;
  payload: string;
}

export interface WaOrderContent {
  type: "order";
  catalogId: string;
  text?: string;
  productItems: Array<Record<string, unknown>>;
}

export interface WaUnknownContent {
  type: "unknown";
  errors?: Array<{ code: number; title: string; details?: string }>;
}

// ─── Click-to-WhatsApp referral ────────────────────────────────────────────

export interface WaReferral {
  source_url: string;
  source_id: string;
  source_type: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
}

// ─── Status update ────────────────────────────────────────────────────────

export type WaMessageStatus = "sent" | "delivered" | "read" | "failed";

export interface WaStatusUpdate {
  /** WAMID of the outbound message this status refers to. */
  id: string;
  status: WaMessageStatus;
  timestamp: string;
  recipientId: string;
  errors?: Array<{ code: number; title: string }>;
}

// ─── Parsed webhook entry ──────────────────────────────────────────────────

/**
 * Result of `parseWebhookEntry(entry)`.
 * Contains all messages and status updates extracted from a single
 * webhook event `entry` object, plus the resolved phone number ID.
 */
export interface ParsedWebhookEntry {
  phoneNumberId: string | null;
  messages: ParsedInboundMessage[];
  statuses: WaStatusUpdate[];
}

// ─── Webhook verification ──────────────────────────────────────────────────

export interface WebhookVerifyParams {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}

export type WebhookVerifyResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: string };
