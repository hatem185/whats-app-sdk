# 01 — Current system inventory (Tasker)

This document summarizes the **existing WhatsApp integration** before extraction. Paths are repo-relative from the Tasker root.

## Canonical implementation surface

### `helpers/whatsappService.ts`

Single large static class **`WhatsAppService`**:

- **API version**: `v21.0`, base `https://graph.facebook.com/v21.0`.
- **Outbound**: `sendTextMessage`, media (URL + media ID), sticker, reaction, location, contacts, **`sendTemplateMessage`**, interactive; `sendTypingIndicator`, `markAsRead`.
- **Media**: `getMediaUrl`, `downloadMedia`, `uploadMedia`.
- **WABA / numbers**: `getMessageTemplates` (single page), **`fetchAllMessageTemplates`** (paging), `createMessageTemplate`, `deleteMessageTemplate`, `getPhoneNumbers`.
- **Profile**: `getBusinessProfile`, `updateBusinessProfile`.
- **Moderation**: `blockUsers`, `unblockUsers`.
- **Webhook**: `verifyWebhookSignature` (HMAC-SHA256), **`parseInboundMessage`** (messages + statuses + `phoneNumberId`).

Supporting exports used elsewhere:

- `deriveWhatsAppTemplateSubmissionName(displayName, mongoIdHex24)` — slug for Meta template **name**.
- `normalizeWhatsAppTemplateLanguageCode(lang)` — maps e.g. `en_US` → `en` for matching.

Return shape for sends: `{ success, messageId?, error? }` with **minimal** Meta error surfacing (`error.message` string when Graph returns `{ error }`).

### Persistence and configuration — `models/crmWhatsappConfig.ts`

Per-organization WhatsApp integration row (**not** part of future SDK persistence; **callers** map env/DB → credentials):

| Field | Role |
|-------|------|
| `phoneNumberId` | Graph **`Phone-Number-ID`** for `/messages`, profile, media, block |
| `businessAccountId` | WABA ID for **`/message_templates`**, **`/phone_numbers`** |
| `accessToken` | **Encrypted** persisted token (`encryptValue` / `decryptValue` from `@Helpers/encryption.ts`) |
| `appSecret` | Optional; enables **`x-hub-signature-256`** verification on webhook |
| `webhookVerifyToken` | Matched against `hub.verify_token` on GET verification |
| **CRM-only policy fields** | SLA, auto-assign, escalation, working hours, inactivity close, `freeTextFallbackTemplate*` |

Indexes: unique `(organizationId, phoneNumberId)` and unique `phoneNumberId` (multi-number support + webhook lookup).

### REST — `controllers/crmWhatsapp.ts`

Admin APIs under `/crm/whatsapp/`:

- Config CRUD (mask token in responses).
- Proxies for Meta: list/create/delete templates, business profile read/update, list WABA phone numbers, block/unblock, media upload.
- Uses decrypted `accessToken` + `WhatsAppService` methods.

Some list endpoints resolve config with `findOne({ organizationId, isActive: true })` without **`phoneNumberId`** — callers with **multiple lines** rely on PUT/GET that accept `phoneNumberId` where implemented; templates create supports optional `phoneNumberId` on the body (**see** `controllers/crmTemplates.ts`).

### Webhook — `controllers/crmWhatsappWebhook.ts`

- **GET** `/crm/whatsapp-webhook/`: verifies `hub.mode === "subscribe"`; loads config by **`webhookVerifyToken`** + `isActive`; returns `hub.challenge` as plain text.
- **POST** `/crm/whatsapp-webhook/`: parses JSON; only processes **`object === "whatsapp_business_account"`**; for each **`entry`**, **`parseInboundMessage`**, resolves **`CrmWhatsappConfigModel`** by **`phoneNumberId`**; optionally verifies **`x-hub-signature-256`** with stored **`appSecret`**; delegates inbound + status handling to **`CrmService`** and queue/async automation.

Important: webhook path is **CRM-coupled**; the reusable package should expose **pure functions** for verify + parse, and optionally a small **`WebhookProcessor` interface** for apps to plug in handlers.

### CRM send path — `helpers/crmService.ts`

- **`sendOutboundMessage`**: resolves `CrmWhatsappConfigModel` by `conversation.organizationId` and **`conversation.whatsappPhoneNumberId`** (if set).
- Recipient: **`contact.phone || contact.whatsappId`** (no centralized E.164 normalizer visible in this path).
- Large **switch** on `type` forwarding to **`WhatsAppService`** (same pattern in **`retryOutboundMessage`**).

**Inbound**: `processInboundMessage` persists messages, marks read via **`WhatsAppService.markAsRead`**, SLA/automation triggers, media download enqueue, etc.

**Status**: **`processStatusUpdate`** maps statuses, extracts **`whatsappErrorCode`** from first webhook error (**e.g. 131047** — outside 24h customer-care window).

### Conversation hints — `controllers/crmConversations.ts`

GET conversation enriches with **`lastInboundMessageAt`**, **`isWithinCustomerCareWindow`**, **`recommendedNextAction`** (`session_ok` vs `use_template`). This is **UI/product logic**, not Cloud API mechanics.

### Templates — CRM model + Meta sync

| Piece | Responsibility |
|--------|----------------|
| **`models/crmTemplate.ts`** | `TemplateCategory`: `marketing`, `utility`, `authentication`; components schema; **`whatsappTemplateId`**, **`whatsappStatus`**, **`rawMetaTemplate`** |
| **`controllers/crmTemplates.ts`** | `buildMetaPayloadForCrmTemplate` uses **`deriveWhatsAppTemplateSubmissionName`**; **`category`** sent to Meta **`UPPERCASE`**; creates row then **`WhatsAppService.createMessageTemplate`** |
| **`helpers/crmTemplateMetaSync.ts`** | **`fetchAllMessageTemplates`** per distinct WABA; matches pending CRM rows by id or **`name`** + **language** |

### Other references

- **`jobs/crmTemplateStatusPoller.ts`**, **`jobs/crmSlaNotifier.ts`**, **`jobs/crmQueueWorker.ts`**, **`helpers/channels/crmUpdates.ts`** — may touch WhatsApp or CRM channels (worth grepping when migrating).
- **Postman CRM exports**: `postman_collection-*.json` may duplicate some routes.

## Secrets and environment

- **Access tokens** are **application-provided plaintext** stored **encrypted** in Mongo via project encryption helpers (`crmWhatsapp` controller/service).
- **No WhatsApp secrets** were found defined purely in `.env` in this inventory pass; integrations are **multi-tenant per org row**. The SDK should accept **`getAccessToken()`** / static string from the host app.

## Logging / error handling today

- **Console** logging in webhook and CRM paths (`console.log` / `console.error` / `console.warn`).
- Send failures persist **`errorDetails`** string on **`CrmMessage`**; statuses attach **`whatsappErrorCode`** numerically where Meta sends errors array.

## Identified gaps (relevant to the new package)

1. **`freeTextFallbackTemplateName` / `Language`** appear in **`WhatsappConfigPolicy`** and model comments (**“automatically re-route outside 24h window”**) but **are not referenced** in **`sendOutboundMessage`** / **`retryOutboundMessage`** implementation — CRM still sends plain text unless the client chooses template messaging.
2. **Graph error typing** is shallow (string `error` vs full `error subcode/code/type/fbtrace_id`).
3. **Retries / idempotency** for outbound sends are **manual** (`retryOutboundMessage` reuses the same message doc) — **no exponential backoff**, **no** header-based idempotency to Meta layer.
4. **Phone normalization** (`E.164` stripping `+`) is **not centralized** next to **`WhatsAppService`**; contacts store whatever the webhook/send path supplied.
5. **Authentication-template send payload** specifics (OTP body parameter shape) should be encapsulated and documented — creation exists in CRM + Postman; send path uses generic **`sendTemplateMessage`**.

## Related source files (quick checklist)

```
helpers/whatsappService.ts
models/crmWhatsappConfig.ts
controllers/crmWhatsapp.ts
controllers/crmWhatsappWebhook.ts
helpers/crmService.ts           (send/retry/process inbound/status）
helpers/crmTemplateMetaSync.ts
controllers/crmTemplates.ts
models/crmTemplate.ts
models/crmContact.ts           (phone / whatsappId)
models/crmConversation.ts      (whatsappPhoneNumberId）
controllers/crmConversations.ts
```

This inventory is the baseline for **`02-package-architecture-and-api.md`** and **`03-meta-api-template-categories-and-postman-map.md`**.
