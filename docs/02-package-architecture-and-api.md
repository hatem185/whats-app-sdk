# 02 — Package architecture and public API (proposal)

## Goals

1. **`plugins/whatsapp-sdk/`** — importable Deno package (later: add **`import_map`** alias such as **`@Plugins/whatsapp-sdk/`** or **`@WaSdk/`**, TBD during implementation).
2. **Zero CRM / Mongo coupling** — no `ObjectId`, no `Crm*` models.
3. **Multi-account** — callers pass **`WhatsAppCredentials`** (or resolver) **`per send`** or **`per client instance`**.
4. **Template categories** — first-class **`utility` \| `marketing` \| `authentication`** at the **intent** layer; implementation still sends Cloud API **`type: "template"`** with validated components.

## Recommended layout

```
plugins/whatsapp-sdk/
  mod.ts                 # re-exports stable surface
  client.ts              # WhatsAppHttpClient — single place for fetch + versioning
  types/
    graph.ts             # Narrow Graph success/error envelopes
    messages.ts          # Outbound payloads (text, template, interactive, ...)
    webhook.ts           # Parsed inbound + statuses
    config.ts            # Credential + options types
  methods/
    messages.ts          # send* helpers
    templates.ts         # list/create/delete; fetch-all with paging
    media.ts
    profile.ts           # whatsapp_business_profile
    phone_numbers.ts     # WABA → phone_numbers
    block_users.ts
  webhook/
    verify.ts            # challenge + signature
    parse.ts             # ported from WhatsAppService.parseInboundMessage + tests for shape drift
  template/
    categories.ts        # TemplateCategory literal + UX helpers
    builders.ts          # buildUtilityTemplate(...), buildMarketing..., buildAuthenticationOtp(...)
    validate.ts          # arity checks vs named/body placeholders; auth OTP rules
  errors/
    graph_error.ts       # parseMetaError(json): { code, subcode?, type?, message, fbtraceId? }
  retry.ts               # optional withRetry(fetchCall, policy)
```

Port **logic** from `helpers/whatsappService.ts` into **`methods/*.ts`** and **`webhook/`**, keeping **URLs and JSON bodies** aligned with **`docs/WhatsApp_Cloud_API_*postman_collection.json`**.

### Versioning strategy

- Constructor option **`graphApiVersion`** defaulting to **`v21.0`** (match current **`WhatsAppService`**).
- Optional **`baseUrl`** override for tests or Meta beta endpoints.

---

## Core types

### `WhatsAppCredentials`

```ts
type WhatsAppCredentials = {
  phoneNumberId: string;      // POST /{phone-number-id}/messages
  businessAccountId: string; // WABA: templates, phone_numbers
  accessToken: string;       // Bearer — host decrypts before call
};
```

Optional **`appSecret`** only needed for webhook verification (hosted outside this type if desired).

### `WhatsAppClientOptions`

- `graphApiVersion?: string`
- `fetch?: typeof fetch` (testing)
- `defaultLanguage?: string` // e.g. "en_US"
- `onRequest?: (info: { method; path; }) => void` **optional tracing hook** (no CRM)
- **`retryPolicy?`** — see **`04-errors-retries-idempotency-logging.md`**

---

## Primary class: `WhatsAppClient`

**Constructor**

`new WhatsAppClient(credentials: WhatsAppCredentials, options?: WhatsAppClientOptions)`

**Multi-number / multi-WABA**

Callers instantiate **multiple clients**, or **`WhatsAppClient.withCredentials(creds)`** factory returning a thin wrapper. Alternatively expose **`cloneWithPatch({ phoneNumberId })`** when WABA/token shared but **`phone_number_id`** differs.

---

## Method groups (map from current `WhatsAppService`)

| Current method | Planned client surface |
|----------------|-------------------------|
| `sendTextMessage` | `messages.sendText({ to, body, previewUrl?, replyToMessageId? })` |
| `sendMedia*` / sticker / reaction / location / contacts / interactive | same namespace |
| `sendTemplateMessage` | `messages.sendTemplate({ to, template })` where **`template`** is strongly typed OR `Record<string, unknown>` escape hatch |
| `sendTypingIndicator` / `markAsRead` | `messages.markRead`, `messages.sendTypingIndicator` |
| `getMessageTemplates` / `fetchAllMessageTemplates` | `templates.list()` + `templates.listAll()` |
| `createMessageTemplate` / `deleteMessageTemplate` | `templates.create(payload)`, `templates.delete({ name, hsm_id? })` |
| `getPhoneNumbers` | `phoneNumbers.list()` |
| `getBusinessProfile` / `updateBusinessProfile` | `profile.get()`, `profile.update(patch)` |
| `blockUsers` / `unblockUsers` | `users.block()`, `users.unblock()` |
| Media upload/download | `media.*` |

All methods return **`Result<T, WhatsAppGraphError>`** or **`Promise<{ ok: true; data: T } | { ok: false; error }>`** (pick one convention and use consistently).

---

## Template intent layer (`template/builders.ts`)

Thin wrappers **on top of** `messages.sendTemplate` so product code does not hand-assemble **`components`** for common cases:

1. **`sendUtilityTemplate`**
   - Order updates, reservations, alerts (Meta **UTILITY** template on Meta side).
   - Parameters: **`name`, `language`, bodyParams: TemplateParam[][, header/button...]`**.

2. **`sendMarketingTemplate`**
   - Promotions — same Cloud API **`template`** envelope; callers responsible for **`marketing_messages` opt-in / regional rules** outside SDK if required by product.

3. **`sendAuthenticationOtpTemplate`**
   - Maps to Meta **authentication** templates with OTP body (**Postman**: *Create authentication template w/ OTP copy code / one-tap*).
   - Builder produces **`components`** consistent with **`docs/WhatsApp_Cloud_API_...postman_collection.json`** and official [authentication templates](https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates) docs for **send** payload.

Expose **`TemplateCategory`** enum mirroring Meta **`AUTHENTICATION` / `MARKETING` / `UTILITY`** (uppercase when sending to **`message_templates`** create API; lowercase internal enum acceptable if documented).

---

## Validation (`template/validate.ts`)

- **`assertComponentArity(name, declaredPlaceholders[], providedParams)`** — fail fast before HTTP.
- **Authentication OTP**: enforce **single code parameter** patterns where Meta requires it; optionally **`maxlength`** guards for **`text`** substrings.
- **Variable naming**: optionally support **`{{1}}`** positional vs **`named`** params per Meta docs; CRM today uses positional-style components in **`sendTemplateMessage`**.

Webhook **parse** validates **presence** of `object`, `entry[]`, but remains **lenient** (unknown message types → raw bucket) matching current **`extractContent`** `default`.

---

## Webhook helpers (pure)

```ts
function verifyWebhookGet(params: { mode, verifyToken, challenge }, compareToken: string): { ok: true; challenge } | { ok: false };

function verifySignature(rawBody: string, xHubSignature256: string | null, appSecret: string): boolean;

function parseWebhookEntry(entry: Record<string, unknown>): ParsedWebhookEntry; // mirrors current parseInboundMessage output shape
```

**No** enqueue, **no** DB — callers implement.

---

## Configuration reading (boundary)

SDK **does not** read **`Deno.env`**. Host applications implement:

```ts
const creds = { phoneNumberId, businessAccountId, accessToken };
const wa = new WhatsAppClient(creds);
```

Optional later: **`whatsapp-sdk/config/env.ts`** with explicit **`readWhatsAppCredentialsFromEnv(): WhatsAppCredentials | null`** gated behind **`--allow-env`** — only if Tasker adopts global env secrets for WhatsApp microservices.

---

## Tasker CRM migration target (thin adapter)

Replace direct **`WhatsAppService`** calls with **`WhatsAppClient`** constructed from decrypted **`TCrmWhatsappConfigOutput`** fields. Keeps **`controllers/*`** unchanged except imports and **`CrmService`** internals.

Retain **`deriveWhatsAppTemplateSubmissionName`** and **`normalizeWhatsAppTemplateLanguageCode`** either:

- **Re-export from SDK** (if generic), or
- Leave in **`@Helpers`** and import only from **`crmTemplates` / meta sync** until CRM-specific naming is reviewed.

See **`05-tasker-migration-checklist.md`** for phased rollout in this monorepo.

---

## Dependencies

- Prefer **std** **`node:crypto` HMAC** (already used) or **`std/crypto`** — match Deno Deploy constraints Tasker targets.
- **No** mongo, validator, oak in the SDK core.
