import type { WhatsAppHttpClient } from "../client.ts";
import type { GraphSendResponse, WhatsAppResult } from "../types/graph.ts";
import type {
  MarkReadParams,
  SendContactsParams,
  SendInteractiveParams,
  SendLocationParams,
  SendMediaByIdParams,
  SendMediaByUrlParams,
  SendReactionParams,
  SendStickerParams,
  SendTemplateParams,
  SendTextParams,
  SendTypingParams,
  WaSendResult,
} from "../types/messages.ts";

// ─── Internal helper ──────────────────────────────────────────────────────

async function send(
  http: WhatsAppHttpClient,
  body: Record<string, unknown>,
): Promise<WhatsAppResult<WaSendResult>> {
  const result = await http.post<GraphSendResponse>(
    `/${http.phoneNumberId}/messages`,
    body,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      messageId: result.data.messages?.[0]?.id ?? "",
      waId: result.data.contacts?.[0]?.wa_id,
    },
  };
}

function context(replyToMessageId?: string): Record<string, unknown> | undefined {
  return replyToMessageId ? { context: { message_id: replyToMessageId } } : undefined;
}

// ─── Text ─────────────────────────────────────────────────────────────────

/**
 * Send a plain-text message.
 *
 * @example
 * await messages.sendText(http, { to: "201001234567", body: "Hello!" });
 */
export function sendText(
  http: WhatsAppHttpClient,
  params: SendTextParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "text",
    text: { body: params.body, preview_url: params.previewUrl ?? false },
    ...context(params.replyToMessageId),
  });
}

// ─── Media ────────────────────────────────────────────────────────────────

/**
 * Send a media message (image / video / audio / document) by public URL.
 */
export function sendMediaByUrl(
  http: WhatsAppHttpClient,
  params: SendMediaByUrlParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const mediaObj: Record<string, unknown> = { link: params.link };
  if (params.caption) mediaObj.caption = params.caption;
  if (params.filename && params.type === "document") {
    mediaObj.filename = params.filename;
  }

  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: params.type,
    [params.type]: mediaObj,
    ...context(params.replyToMessageId),
  });
}

/**
 * Send a media message by a previously uploaded WhatsApp media ID.
 */
export function sendMediaById(
  http: WhatsAppHttpClient,
  params: SendMediaByIdParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const mediaObj: Record<string, unknown> = { id: params.mediaId };
  if (params.caption && params.type !== "audio") {
    mediaObj.caption = params.caption;
  }
  if (params.filename && params.type === "document") {
    mediaObj.filename = params.filename;
  }

  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: params.type,
    [params.type]: mediaObj,
    ...context(params.replyToMessageId),
  });
}

// ─── Sticker ──────────────────────────────────────────────────────────────

/**
 * Send a static sticker (512×512, ≤100 KB) by URL or media ID.
 */
export function sendSticker(
  http: WhatsAppHttpClient,
  params: SendStickerParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const stickerObj: Record<string, unknown> = params.mediaId
    ? { id: params.mediaId }
    : { link: params.link ?? "" };

  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "sticker",
    sticker: stickerObj,
    ...context(params.replyToMessageId),
  });
}

// ─── Reaction ─────────────────────────────────────────────────────────────

/**
 * React to a message with an emoji. Pass `""` to remove an existing reaction.
 */
export function sendReaction(
  http: WhatsAppHttpClient,
  params: SendReactionParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "reaction",
    reaction: { message_id: params.messageId, emoji: params.emoji },
  });
}

// ─── Location ─────────────────────────────────────────────────────────────

/**
 * Send a pin-drop location card.
 */
export function sendLocation(
  http: WhatsAppHttpClient,
  params: SendLocationParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const loc: Record<string, unknown> = {
    latitude: params.latitude,
    longitude: params.longitude,
  };
  if (params.name) loc.name = params.name;
  if (params.address) loc.address = params.address;

  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "location",
    location: loc,
    ...context(params.replyToMessageId),
  });
}

// ─── Contacts ─────────────────────────────────────────────────────────────

/**
 * Send one or more vCard-style contact cards.
 */
export function sendContacts(
  http: WhatsAppHttpClient,
  params: SendContactsParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "contacts",
    contacts: params.contacts,
    ...context(params.replyToMessageId),
  });
}

// ─── Interactive ──────────────────────────────────────────────────────────

/**
 * Send an interactive message (list, reply buttons, product, etc.).
 * Callers compose the full `interactive` object for maximum flexibility.
 */
export function sendInteractive(
  http: WhatsAppHttpClient,
  params: SendInteractiveParams,
): Promise<WhatsAppResult<WaSendResult>> {
  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "interactive",
    interactive: params.interactive,
    ...context(params.replyToMessageId),
  });
}

// ─── Template ─────────────────────────────────────────────────────────────

/**
 * Send a Meta-approved template message (utility, marketing, or authentication).
 * For strongly-typed category helpers see `template/builders.ts`.
 */
export function sendTemplate(
  http: WhatsAppHttpClient,
  params: SendTemplateParams,
): Promise<WhatsAppResult<WaSendResult>> {
  const template: Record<string, unknown> = {
    name: params.templateName,
    language: { code: params.language },
  };
  if (params.components && params.components.length > 0) {
    template.components = params.components;
  }

  return send(http, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template,
    ...context(params.replyToMessageId),
  });
}

// ─── Read receipts / Typing ───────────────────────────────────────────────

/**
 * Mark an inbound message as read (triggers blue ticks on the customer side).
 */
export async function markAsRead(
  http: WhatsAppHttpClient,
  params: MarkReadParams,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.post<{ success: boolean }>(
    `/${http.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: params.messageId,
    },
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}

/**
 * Send a typing indicator to a customer.
 * Must be called with the WAMID of their most recent inbound message.
 */
export async function sendTypingIndicator(
  http: WhatsAppHttpClient,
  params: SendTypingParams,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.post<{ success: boolean }>(
    `/${http.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: params.messageId,
      typing_indicator: { type: "text" },
    },
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}
