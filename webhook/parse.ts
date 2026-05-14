import type {
  ParsedInboundMessage,
  ParsedWebhookEntry,
  WaButtonContent,
  WaContactsContent,
  WaInboundContent,
  WaInteractiveContent,
  WaLocationContent,
  WaMediaContent,
  WaOrderContent,
  WaReactionContent,
  WaStickerContent,
  WaStatusUpdate,
  WaTextContent,
  WaUnknownContent,
} from "../types/webhook.ts";

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Parse a single `entry` object from a Meta webhook payload.
 *
 * Meta sends a JSON body shaped as:
 * ```json
 * { "object": "whatsapp_business_account", "entry": [ ...entries ] }
 * ```
 *
 * Call this once per entry in the `entry` array. The function is **pure**
 * (no side effects, no network calls) so it is safe to call synchronously
 * inside any HTTP handler.
 *
 * @example
 * const payload = await req.json();
 * if (payload.object !== "whatsapp_business_account") return;
 * for (const entry of payload.entry ?? []) {
 *   const parsed = parseWebhookEntry(entry);
 *   for (const msg of parsed.messages) { ... }
 *   for (const status of parsed.statuses) { ... }
 * }
 */
export function parseWebhookEntry(
  entry: Record<string, unknown>,
): ParsedWebhookEntry {
  const messages: ParsedInboundMessage[] = [];
  const statuses: WaStatusUpdate[] = [];
  let phoneNumberId: string | null = null;

  const changes = (entry.changes ?? []) as Array<Record<string, unknown>>;
  for (const change of changes) {
    const value = change.value as Record<string, unknown> | undefined;
    if (!value) continue;

    // Resolve the phone number ID from metadata.
    const metadata = value.metadata as Record<string, unknown> | undefined;
    if (metadata?.phone_number_id) {
      phoneNumberId = String(metadata.phone_number_id);
    }

    // Build a profile-name lookup for this batch.
    const contacts = (value.contacts ?? []) as Array<Record<string, unknown>>;
    const profileMap = new Map<string, string>();
    for (const contact of contacts) {
      const waId = String(contact.wa_id ?? "");
      const profile = contact.profile as Record<string, unknown> | undefined;
      if (waId && profile?.name) {
        profileMap.set(waId, String(profile.name));
      }
    }

    // Parse inbound messages.
    const rawMessages = (value.messages ?? []) as Array<Record<string, unknown>>;
    for (const raw of rawMessages) {
      const type = String(raw.type ?? "unknown");
      const content = extractContent(raw, type);
      const ctx = raw.context as { from: string; id: string } | undefined;

      messages.push({
        from: String(raw.from ?? ""),
        messageId: String(raw.id ?? ""),
        timestamp: String(raw.timestamp ?? ""),
        // deno-lint-ignore no-explicit-any
        type: type as any,
        content,
        profileName: profileMap.get(String(raw.from ?? "")),
        context: ctx,
      });
    }

    // Parse delivery status updates.
    const rawStatuses = (value.statuses ?? []) as Array<Record<string, unknown>>;
    for (const s of rawStatuses) {
      statuses.push({
        id: String(s.id ?? ""),
        status: String(s.status ?? "") as WaStatusUpdate["status"],
        timestamp: String(s.timestamp ?? ""),
        recipientId: String(s.recipient_id ?? ""),
        errors: s.errors as WaStatusUpdate["errors"],
      });
    }
  }

  return { phoneNumberId, messages, statuses };
}

/**
 * Guard: returns true when the webhook payload is a WhatsApp Business Account event.
 * Use this before iterating `entry` arrays.
 */
export function isWhatsAppWebhookPayload(
  payload: unknown,
): payload is { object: "whatsapp_business_account"; entry: Array<Record<string, unknown>> } {
  return (
    payload !== null &&
    typeof payload === "object" &&
    (payload as Record<string, unknown>).object === "whatsapp_business_account"
  );
}

// ─── Content extractor ────────────────────────────────────────────────────

function extractContent(
  msg: Record<string, unknown>,
  type: string,
): WaInboundContent {
  switch (type) {
    case "text": {
      const t = msg.text as { body?: string } | undefined;
      const result: WaTextContent = {
        type: "text",
        text: t?.body ?? "",
      };
      if (msg.referral) {
        result.referral = msg.referral as WaTextContent["referral"];
      }
      return result;
    }

    case "image": {
      const m = msg.image as Record<string, unknown> | undefined;
      return {
        type: "image",
        mediaId: String(m?.id ?? ""),
        mimeType: m?.mime_type as string | undefined,
        caption: m?.caption as string | undefined,
      } satisfies WaMediaContent;
    }

    case "video": {
      const m = msg.video as Record<string, unknown> | undefined;
      return {
        type: "video",
        mediaId: String(m?.id ?? ""),
        mimeType: m?.mime_type as string | undefined,
        caption: m?.caption as string | undefined,
      } satisfies WaMediaContent;
    }

    case "audio": {
      const m = msg.audio as Record<string, unknown> | undefined;
      return {
        type: "audio",
        mediaId: String(m?.id ?? ""),
        mimeType: m?.mime_type as string | undefined,
        isVoice: Boolean(m?.voice ?? false),
      } satisfies WaMediaContent;
    }

    case "document": {
      const m = msg.document as Record<string, unknown> | undefined;
      return {
        type: "document",
        mediaId: String(m?.id ?? ""),
        mimeType: m?.mime_type as string | undefined,
        caption: m?.caption as string | undefined,
        fileName: m?.filename as string | undefined,
      } satisfies WaMediaContent;
    }

    case "sticker": {
      const m = msg.sticker as Record<string, unknown> | undefined;
      return {
        type: "sticker",
        mediaId: String(m?.id ?? ""),
        mimeType: m?.mime_type as string | undefined,
      } satisfies WaStickerContent;
    }

    case "location": {
      const l = msg.location as Record<string, unknown> | undefined;
      return {
        type: "location",
        latitude: l?.latitude as number | undefined,
        longitude: l?.longitude as number | undefined,
        name: l?.name as string | undefined,
        address: l?.address as string | undefined,
      } satisfies WaLocationContent;
    }

    case "contacts": {
      return {
        type: "contacts",
        contacts: (msg.contacts as Array<Record<string, unknown>>) ?? [],
      } satisfies WaContactsContent;
    }

    case "interactive": {
      const i = msg.interactive as Record<string, unknown> | undefined;
      return {
        type: "interactive",
        interactiveType: i?.type as string | undefined,
        buttonReply: i?.button_reply as WaInteractiveContent["buttonReply"],
        listReply: i?.list_reply as WaInteractiveContent["listReply"],
      } satisfies WaInteractiveContent;
    }

    case "reaction": {
      // Meta API has a documented typo: "messsage_id" (triple-s).
      const r = msg.reaction as Record<string, unknown> | undefined;
      return {
        type: "reaction",
        emoji: String(r?.emoji ?? ""),
        messageId: String((r?.messsage_id ?? r?.message_id) ?? ""),
      } satisfies WaReactionContent;
    }

    case "button": {
      const b = msg.button as Record<string, unknown> | undefined;
      return {
        type: "button",
        text: String(b?.text ?? ""),
        payload: String(b?.payload ?? ""),
      } satisfies WaButtonContent;
    }

    case "order": {
      const o = msg.order as Record<string, unknown> | undefined;
      return {
        type: "order",
        catalogId: String(o?.catalog_id ?? ""),
        text: o?.text as string | undefined,
        productItems: (o?.product_items as Array<Record<string, unknown>>) ?? [],
      } satisfies WaOrderContent;
    }

    case "unknown":
    default: {
      return {
        type: "unknown",
        errors: (msg.errors as WaUnknownContent["errors"]) ?? [],
      } satisfies WaUnknownContent;
    }
  }
}
