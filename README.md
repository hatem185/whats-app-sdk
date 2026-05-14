# WhatsApp SDK

A production-ready, reusable WhatsApp Business / WhatsApp Cloud API integration package for Deno. Designed to be imported by any service or system that needs structured WhatsApp messaging — not tied to any CRM, database, or framework.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Package Structure](#package-structure)
4. [Installation & Import](#installation--import)
5. [Configuration](#configuration)
6. [Quick Start](#quick-start)
7. [Sending Messages](#sending-messages)
   - [Text Messages](#text-messages)
   - [Media Messages](#media-messages)
   - [Other Message Types](#other-message-types)
   - [Interactive Messages](#interactive-messages)
8. [Template Messages](#template-messages)
   - [Utility Templates](#utility-templates)
   - [Marketing Templates](#marketing-templates)
   - [Authentication / OTP Templates](#authentication--otp-templates)
   - [Raw Template Send](#raw-template-send)
9. [Template Management](#template-management)
   - [Create Templates](#create-templates)
   - [List Templates](#list-templates)
   - [Delete Templates](#delete-templates)
10. [Phone Number Management](#phone-number-management)
11. [Business Profile](#business-profile)
12. [Media Upload & Download](#media-upload--download)
13. [Block & Unblock Users](#block--unblock-users)
14. [Webhook Integration](#webhook-integration)
    - [Webhook Verification (GET)](#webhook-verification-get)
    - [Inbound Message Parsing (POST)](#inbound-message-parsing-post)
15. [Error Handling](#error-handling)
16. [Retry Policy](#retry-policy)
17. [Multi-Account & Multi-Number Support](#multi-account--multi-number-support)
18. [Phone Number Normalization](#phone-number-normalization)
19. [Template Utilities](#template-utilities)
20. [TypeScript Type Reference](#typescript-type-reference)
21. [Production Notes](#production-notes)
22. [Integration Patterns](#integration-patterns)
23. [What Is Out of Scope](#what-is-out-of-scope)
24. [References (`docs/`)](#references-docs)

---

## Overview

This SDK provides a clean, typed HTTP client for the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) (Meta Graph API). It handles:

- Constructing correct Cloud API payloads for all message types
- Managing templates (create, list, delete, sync status)
- Sending Utility, Marketing, and Authentication (OTP) template messages
- Webhook challenge verification and inbound message parsing
- Structured Meta error normalization with known error codes
- Automatic retries with exponential backoff and `Retry-After` header support
- Multi-WABA and multi-phone-number configurations

The package is **framework-agnostic** and has **zero dependencies on any CRM system, database, queue, or HTTP framework**. Callers supply credentials; the SDK handles the wire protocol.

---

## Features

| Category | Capability |
|----------|-----------|
| **Messaging** | Text, image, video, audio, document, sticker, reaction, location, contacts, interactive |
| **Templates** | Send utility, marketing, and authentication / OTP templates |
| **Template builders** | High-level helpers that assemble `components` arrays automatically |
| **Template management** | Create, list (single page + all pages), delete |
| **Template validation** | Pre-send arity checks, OTP code length, name format validation |
| **Template utilities** | Derive submission names, normalize language codes |
| **Media** | Upload to WhatsApp media store, download by URL, delete |
| **Webhook** | Challenge verification (GET) and HMAC-SHA256 signature validation (POST) |
| **Webhook parsing** | Pure inbound message parser — text, media, interactive, reaction, order, unknown |
| **Phone numbers** | List phone numbers registered to a WABA |
| **Business profile** | Read and update the WhatsApp Business Profile |
| **User moderation** | Block and unblock users |
| **Error handling** | Structured `WhatsAppGraphError` with `code`, `errorSubcode`, `fbtraceId`, `retryAfterMs` |
| **Known error codes** | `WA_ERROR_CODE` catalogue (131047, 132001, 130429, and more) |
| **Retries** | Exponential backoff + jitter, `Retry-After` header support, configurable predicate |
| **Multi-account** | Clone client with a different phone number or full credentials |
| **TypeScript** | Complete types for all inputs, outputs, and webhook shapes |
| **No env coupling** | The SDK never reads `Deno.env` — caller passes credentials explicitly |

---

## Package Structure

```
plugins/whatsapp-sdk/
  mod.ts                      ← single import entry point
  WhatsAppClient.ts           ← main facade with namespaced sub-clients
  client.ts                   ← WhatsAppHttpClient (HTTP, auth, retries)
  retry.ts                    ← withRetry(), DEFAULT_RETRY_POLICY
  types/
    config.ts                 ← WhatsAppCredentials, WhatsAppClientOptions, RetryPolicy
    graph.ts                  ← WhatsAppResult<T>, WhatsAppGraphError, WA_ERROR_CODE
    messages.ts               ← all outbound param / result types
    webhook.ts                ← ParsedInboundMessage, WaStatusUpdate, content unions
  errors/
    graph_error.ts            ← parseMetaError(), wrapNetworkError(), defaultRetryPredicate()
  methods/
    messages.ts               ← individual send* functions
    media.ts                  ← upload, download, delete
    templates.ts              ← list, listAll, create, delete
    profile.ts                ← getBusinessProfile, updateBusinessProfile
    phone_numbers.ts          ← listPhoneNumbers
    block_users.ts            ← blockUsers, unblockUsers
  webhook/
    verify.ts                 ← verifyWebhookChallenge(), verifyWebhookSignature()
    parse.ts                  ← parseWebhookEntry(), isWhatsAppWebhookPayload()
  template/
    categories.ts             ← TEMPLATE_CATEGORY, toMetaCategory(), categoryLabel()
    builders.ts               ← sendUtilityTemplate, sendMarketingTemplate, sendAuthOtpTemplate
                                 buildUtilityTemplatePayload, buildMarketingTemplatePayload, buildAuthTemplatePayload
    validate.ts               ← assertComponentArity(), assertOtpCode(), assertTemplateName(), textParam()
  utils/
    phone.ts                  ← normalizeWhatsAppRecipient(), tryNormalizeWhatsAppRecipient()
    template_name.ts          ← deriveWhatsAppTemplateSubmissionName(), normalizeWhatsAppTemplateLanguageCode()
```

---

## Installation & Import

### Using the import map alias (recommended within this repo)

Add the following to `import_map.json`:

```jsonc
// import_map.json
{
  "imports": {
    "@WhatsApp/sdk":  "./plugins/whatsapp-sdk/mod.ts",
    "@WhatsApp/sdk/": "./plugins/whatsapp-sdk/"
  }
}
```

Then import anywhere in the project:

```ts
import { WhatsAppClient } from "@WhatsApp/sdk";
```

### Using a relative path (for external services)

```ts
import { WhatsAppClient } from "./packages/whatsapp-sdk/mod.ts";
```

### Sub-module imports

```ts
// Webhook helpers only (no HTTP client)
import { parseWebhookEntry, verifyWebhookSignature } from "@WhatsApp/sdk";

// Or from sub-modules directly:
import { parseWebhookEntry }           from "@WhatsApp/sdk/webhook/parse.ts";
import { verifyWebhookSignature }      from "@WhatsApp/sdk/webhook/verify.ts";
import { normalizeWhatsAppRecipient }  from "@WhatsApp/sdk/utils/phone.ts";
```

---

## Configuration

### Credentials

```ts
import type { WhatsAppCredentials } from "@WhatsApp/sdk";

const credentials: WhatsAppCredentials = {
  /**
   * Meta Phone-Number-ID.
   * Used for /messages, media, profile, and block endpoints.
   */
  phoneNumberId: "1234567890",

  /**
   * WhatsApp Business Account ID (WABA ID).
   * Used for templates and phone_numbers endpoints.
   */
  businessAccountId: "0987654321",

  /**
   * Plain-text Meta Graph API Bearer token.
   * Decrypt before passing — the SDK never decrypts anything.
   */
  accessToken: "EAAxxxxxx...",
};
```

### Client Options

```ts
import type { WhatsAppClientOptions } from "@WhatsApp/sdk";

const options: WhatsAppClientOptions = {
  /**
   * Graph API version to pin. Avoids surprise breaking changes on upgrades.
   * @default "v21.0"
   */
  graphApiVersion: "v21.0",

  /**
   * Default language code used by template builder helpers when `language`
   * is omitted.
   * @default "en"
   */
  defaultLanguage: "ar",

  /**
   * Override the Graph base URL. Useful for Meta beta environments.
   * @default "https://graph.facebook.com"
   */
  baseUrl: "https://graph.facebook.com",

  /**
   * Inject a custom fetch for tests or controlled environments.
   * @default globalThis.fetch
   */
  fetch: myCustomFetch,

  /**
   * Called before every outgoing request.
   * Receives method, relative path, and body size.
   * Never receives the access token.
   */
  onRequest: ({ method, path, bodySize }) => {
    console.log(`[WA] ${method} ${path} (${bodySize ?? 0} bytes)`);
  },

  /**
   * Retry policy for transient failures.
   * Pass null to disable retries entirely.
   * @default 3 attempts, 300 ms base, 8 s cap, retries on network errors + 429 + 5xx
   */
  retryPolicy: {
    maxAttempts: 3,
    baseMs: 300,
    maxMs: 8_000,
    jitterRatio: 0.25,
    retryPredicate: (err) => {
      const status = "httpStatus" in err ? err.httpStatus : 0;
      return status === 0 || status === 429 || status >= 500;
    },
  },
};
```

---

## Quick Start

```ts
import { WhatsAppClient } from "@WhatsApp/sdk";

const wa = new WhatsAppClient(
  {
    phoneNumberId:     "1234567890",
    businessAccountId: "0987654321",
    accessToken:       decryptedToken,
  },
  { defaultLanguage: "ar" },
);

// Every method returns WhatsAppResult<T>
const result = await wa.messages.sendText({
  to:   "201001234567",
  body: "مرحباً بك!",
});

if (result.ok) {
  console.log("Sent:", result.data.messageId); // wamid.XXX
} else {
  console.error(result.error.code, result.error.message);
}
```

---

## Sending Messages

All send methods return `Promise<WhatsAppResult<WaSendResult>>`:

```ts
type WhatsAppResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: WhatsAppGraphError };

interface WaSendResult {
  messageId: string;  // Meta WAMID
  waId?:     string;  // Canonical WA ID returned by Meta
}
```

### Text Messages

```ts
// Simple text
await wa.messages.sendText({ to: "201001234567", body: "Hello!" });

// With URL preview card
await wa.messages.sendText({
  to:         "201001234567",
  body:       "Check out https://example.com",
  previewUrl: true,
});

// As a quoted reply
await wa.messages.sendText({
  to:               "201001234567",
  body:             "Got your message!",
  replyToMessageId: "wamid.abc123",
});
```

### Media Messages

```ts
// Image by public URL
await wa.messages.sendMediaByUrl({
  to:      "201001234567",
  type:    "image",
  link:    "https://example.com/photo.jpg",
  caption: "Your order is ready.",
});

// Document by previously uploaded media ID
await wa.messages.sendMediaById({
  to:       "201001234567",
  type:     "document",
  mediaId:  "media-id-from-upload",
  filename: "invoice.pdf",
  caption:  "Invoice #1234",
});

// Supported types: "image" | "video" | "audio" | "document"
```

### Other Message Types

```ts
// Sticker — by URL or media ID
await wa.messages.sendSticker({ to: "201001234567", link: "https://..." });
await wa.messages.sendSticker({ to: "201001234567", mediaId: "sticker-media-id" });

// Reaction (emoji on a prior message)
await wa.messages.sendReaction({
  to:        "201001234567",
  messageId: "wamid.abc123",
  emoji:     "👍",
});
// Remove a reaction — pass empty emoji
await wa.messages.sendReaction({ to: "201001234567", messageId: "wamid.abc123", emoji: "" });

// Location pin
await wa.messages.sendLocation({
  to:        "201001234567",
  latitude:  30.0444,
  longitude: 31.2357,
  name:      "Cairo Tower",
  address:   "Gezira Island, Cairo, Egypt",
});

// Contact card
await wa.messages.sendContacts({
  to: "201001234567",
  contacts: [{
    name:   { formatted_name: "Ahmed Ali", first_name: "Ahmed" },
    phones: [{ phone: "201001234568", type: "CELL" }],
  }],
});

// Typing indicator (requires the customer's last inbound message ID)
await wa.messages.sendTypingIndicator({ messageId: "wamid.abc123" });

// Mark as read (blue ticks)
await wa.messages.markAsRead({ messageId: "wamid.abc123" });
```

### Interactive Messages

```ts
// Reply buttons
await wa.messages.sendInteractive({
  to: "201001234567",
  interactive: {
    type: "button",
    body: { text: "Confirm your appointment?" },
    action: {
      buttons: [
        { type: "reply", reply: { id: "yes", title: "Yes ✓" } },
        { type: "reply", reply: { id: "no",  title: "No ✗" } },
      ],
    },
  },
});

// List message
await wa.messages.sendInteractive({
  to: "201001234567",
  interactive: {
    type: "list",
    body:   { text: "Choose a department:" },
    action: {
      button: "Select",
      sections: [{
        title: "Support",
        rows: [
          { id: "billing", title: "Billing",   description: "Payment & invoices" },
          { id: "tech",    title: "Technical", description: "System issues" },
        ],
      }],
    },
  },
});
```

---

## Template Messages

Templates must be approved by Meta before they can be sent. The category (Utility, Marketing, Authentication) is set at approval time — the send path is identical at the API level for all three.

### Utility Templates

For transactional messages: order updates, appointment reminders, shipping alerts, account activity.

```ts
// Body-only — positional {{1}}, {{2}} parameters
const result = await wa.sendUtilityTemplate({
  to:           "201001234567",
  templateName: "order_shipped",
  language:     "ar",
  bodyParams:   ["ORD-9821", "يومين"], // fills {{1}}, {{2}}
});

// With header and button parameters
const result = await wa.sendUtilityTemplate({
  to:           "201001234567",
  templateName: "appointment_reminder",
  language:     "en",
  bodyParams:   ["Dr. Smith", "Monday 10 AM"],
  headerParams: [{ type: "text", text: "Reminder" }],
  buttonParams: [
    { index: 0, params: [{ type: "payload", payload: "CONFIRM_APT_123" }] },
  ],
});

if (!result.ok) {
  const { code, message } = result.error;
  // code === 131047 → outside 24-hour customer care window; must use a template (already doing so)
  // code === 132001 → template not approved
}
```

### Marketing Templates

For promotions, discounts, and product announcements. Subscriber opt-in and regional compliance are the caller's responsibility.

```ts
const result = await wa.sendMarketingTemplate({
  to:           "201001234567",
  templateName: "summer_sale_2026",
  language:     "ar",
  bodyParams:   ["30%", "30 يونيو"],
  // _optInConfirmed: true  ← pass this to signal your code has verified opt-in
});
```

### Authentication / OTP Templates

For one-time passcodes. The SDK assembles the required `BODY` and `BUTTONS` components automatically — you supply only the code.

```ts
// COPY_CODE — customer copies the code manually
const result = await wa.sendAuthOtp({
  to:           "201001234567",
  templateName: "verify_otp",
  language:     "en",
  otpCode:      "847213",
});

// ONE_TAP — Android autofills the code in your app
const result = await wa.sendAuthOtp({
  to:           "201001234567",
  templateName: "verify_otp_autofill",
  language:     "en",
  otpCode:      "847213",
});
```

> `otpCode` must be 1–15 characters. A `TemplateValidationError` is thrown synchronously before any network call if the code is invalid.

### Raw Template Send

When you need full control over the `components` array:

```ts
import { WA_ERROR_CODE } from "@WhatsApp/sdk";

const result = await wa.messages.sendTemplate({
  to:           "201001234567",
  templateName: "my_custom_template",
  language:     "en",
  components: [
    {
      type:       "header",
      parameters: [{ type: "image", image: { link: "https://example.com/banner.jpg" } }],
    },
    {
      type:       "body",
      parameters: [
        { type: "text", text: "Ahmed" },
        { type: "currency", currency: { fallback_value: "$10.00", code: "USD", amount_1000: 10000 } },
      ],
    },
    {
      type:       "button",
      sub_type:   "url",
      index:      0,
      parameters: [{ type: "text", text: "order/ORD-9821" }],
    },
  ],
});

if (!result.ok && result.error.code === WA_ERROR_CODE.TEMPLATE_PARAMETER_COUNT_MISMATCH) {
  // fix your components array
}
```

---

## Template Management

### Create Templates

**Utility or Marketing template:**

```ts
import { buildUtilityTemplatePayload } from "@WhatsApp/sdk";

const payload = buildUtilityTemplatePayload({
  name:         "order_shipped",    // must be snake_case lowercase
  language:     "ar",
  bodyText:     "طلبك {{1}} تم شحنه وسيصل خلال {{2}}.",
  headerText:   "تحديث الطلب",
  footerText:   "شكراً لتسوقك معنا",
  bodyExamples: ["ORD-9821", "يومين"],  // example values help Meta's review
  buttons: [
    { type: "QUICK_REPLY", text: "تتبع الطلب" },
  ],
});

const result = await wa.templates.create(payload);
if (result.ok) {
  console.log("Template ID:", result.data.templateId);
  console.log("Status:", result.data.status); // PENDING until Meta approves
}
```

**Authentication / OTP template:**

```ts
import { buildAuthTemplatePayload } from "@WhatsApp/sdk";

// COPY_CODE variant
const payload = buildAuthTemplatePayload({
  name:                      "verify_otp",
  language:                  "en",
  otpType:                   "COPY_CODE",
  buttonText:                "Copy Code",
  addSecurityRecommendation: true,
  codeExpirationMinutes:     10,
});

// ONE_TAP autofill variant (Android)
const payload = buildAuthTemplatePayload({
  name:                      "verify_otp_autofill",
  language:                  "en",
  otpType:                   "ONE_TAP",
  buttonText:                "Copy Code",
  addSecurityRecommendation: true,
  codeExpirationMinutes:     10,
  packageName:               "com.example.myapp",
  signatureHash:             "K8a%2FAINcGX7",
});

await wa.templates.create(payload);
```

### List Templates

```ts
// Single page (defaults to 100 per page)
const result = await wa.templates.list();
if (result.ok) {
  const { data, paging } = result.data;
  console.log(`${data.length} templates on this page`);
  console.log("Next cursor:", paging?.next);
}

// Fetch ALL templates across all pages automatically
const result = await wa.templates.listAll();
if (result.ok) {
  for (const tpl of result.data) {
    console.log(tpl.name, tpl.language, tpl.status);
  }
}

// With filters
const result = await wa.templates.list({
  fields:   "id,name,language,status,category,rejection_reason",
  status:   "APPROVED",
  category: "UTILITY",
  limit:    50,
});
```

### Delete Templates

```ts
// By name — removes all language variants
await wa.templates.delete({ name: "old_promo_template" });

// By name + hsm_id — targets a specific language variant
await wa.templates.delete({ name: "old_promo_template", hsm_id: "1473688840035974" });
```

---

## Phone Number Management

```ts
// List all phone numbers on the WABA
const result = await wa.phoneNumbers.list();
if (result.ok) {
  for (const num of result.data) {
    console.log(num.display_phone_number, num.quality_rating, num.verified_name);
  }
}

// Request specific fields
const result = await wa.phoneNumbers.list("id,display_phone_number,quality_rating");
```

---

## Business Profile

```ts
// Read
const result = await wa.profile.get();
if (result.ok) {
  const { about, email, websites, vertical } = result.data;
}

// Update — only the supplied fields are changed
await wa.profile.update({
  about:       "Official support channel. Available 9 AM – 6 PM, Mon–Sat.",
  address:     "123 Main Street, Cairo, Egypt",
  email:       "support@example.com",
  websites:    ["https://example.com"],
  vertical:    "RETAIL",
  description: "Your trusted online store.",
});
```

---

## Media Upload & Download

```ts
// Upload a file to the WhatsApp media store (reusable for 30 days)
const fileData = await Deno.readFile("invoice.pdf");
const result = await wa.media.upload(fileData.buffer, "application/pdf", "invoice.pdf");
if (result.ok) {
  const { mediaId } = result.data;
}

// Get download URL for a media ID received in a webhook
const infoResult = await wa.media.getInfo("media-id-from-webhook");
if (infoResult.ok) {
  const { url, mime_type, file_size } = infoResult.data;

  // Download the binary content
  const downloadResult = await wa.media.download(url);
  if (downloadResult.ok) {
    await Deno.writeFile("received.jpg", new Uint8Array(downloadResult.data));
  }
}

// Delete a media file
await wa.media.delete("media-id");
```

---

## Block & Unblock Users

```ts
// Block users — E.164 digits, no leading +
await wa.users.block({ userPhones: ["201001234567", "201009876543"] });

// Unblock
await wa.users.unblock({ userPhones: ["201001234567"] });
```

---

## Webhook Integration

The SDK provides pure, stateless helper functions for both steps of the Meta webhook handshake. They require no client instance.

### Webhook Verification (GET)

Meta sends `hub.mode`, `hub.verify_token`, and `hub.challenge` to confirm your endpoint is live.

```ts
import { verifyWebhookChallenge } from "@WhatsApp/sdk";

// Example using Oak — same pattern for any framework
router.get("/webhook", (ctx) => {
  const url = ctx.request.url;

  const result = verifyWebhookChallenge(
    {
      mode:        url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge:   url.searchParams.get("hub.challenge"),
    },
    storedWebhookVerifyToken, // the secret you registered in the Meta App Dashboard
  );

  if (result.ok) {
    ctx.response.body = result.challenge; // echo back as plain text
  } else {
    ctx.response.status = 403;
    ctx.response.body   = result.reason;
  }
});
```

### Inbound Message Parsing (POST)

```ts
import {
  isWhatsAppWebhookPayload,
  parseWebhookEntry,
  verifyWebhookSignature,
  WA_ERROR_CODE,
} from "@WhatsApp/sdk";

router.post("/webhook", async (ctx) => {
  // 1. Read raw body BEFORE parsing — signature is computed on raw bytes
  const rawBody = await ctx.request.body.text();

  // 2. Verify HMAC-SHA256 signature
  const signature = ctx.request.headers.get("x-hub-signature-256");
  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    ctx.response.status = 200; // still return 200 to Meta — silently reject
    return;
  }

  // 3. Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    ctx.response.status = 200;
    return;
  }

  // 4. Guard — ignore non-WhatsApp events
  if (!isWhatsAppWebhookPayload(payload)) {
    ctx.response.status = 200;
    return;
  }

  // 5. Process each entry
  for (const entry of payload.entry) {
    const { phoneNumberId, messages, statuses } = parseWebhookEntry(entry);

    for (const msg of messages) {
      console.log(`From: ${msg.from}  Profile: ${msg.profileName}  Type: ${msg.type}`);

      if (msg.type === "text") {
        const { text } = msg.content;                 // WaTextContent
      } else if (msg.type === "image") {
        const { mediaId, caption } = msg.content;     // WaMediaContent
        // download: wa.media.getInfo(mediaId) → wa.media.download(url)
      } else if (msg.type === "interactive") {
        const { buttonReply, listReply } = msg.content; // WaInteractiveContent
      } else if (msg.type === "button") {
        const { payload } = msg.content;              // WaButtonContent — quick reply from template
      }
    }

    for (const status of statuses) {
      console.log(`Message ${status.id} → ${status.status}`);

      if (status.status === "failed" && status.errors?.length) {
        const code = status.errors[0].code;
        if (code === WA_ERROR_CODE.OUTSIDE_CUSTOMER_CARE_WINDOW) {
          // session closed — switch to a template
        }
      }
    }
  }

  // Always return 200 — process async, never block Meta's delivery
  ctx.response.status = 200;
  ctx.response.body   = { ok: true };
});
```

---

## Error Handling

Every SDK method returns `WhatsAppResult<T>` — it never throws (template validation helpers are the only exception; they throw synchronously before any network call).

```ts
const result = await wa.messages.sendText({ to: "201001234567", body: "Hi" });

if (!result.ok) {
  const err = result.error;

  console.error(`HTTP ${err.httpStatus} — ${err.message}`);
  console.error(`Graph code:  ${err.code}`);         // e.g. 131047
  console.error(`Subcode:     ${err.errorSubcode}`);
  console.error(`Error type:  ${err.type}`);         // e.g. "OAuthException"
  console.error(`FBTrace ID:  ${err.fbtraceId}`);    // use this in Meta support requests
}
```

### Known Error Codes

Use `WA_ERROR_CODE` constants instead of hard-coding numbers:

```ts
import { WA_ERROR_CODE } from "@WhatsApp/sdk";

if (!result.ok) {
  switch (result.error.code) {
    case WA_ERROR_CODE.OUTSIDE_CUSTOMER_CARE_WINDOW:
      // 131047 — 24h window closed; must use an approved template
      await sendFallbackTemplate(to);
      break;

    case WA_ERROR_CODE.TEMPLATE_NOT_APPROVED:
      // 132001 — template is still pending or was rejected
      break;

    case WA_ERROR_CODE.RECIPIENT_NOT_ON_WHATSAPP:
      // 131026 — phone number is not on WhatsApp
      break;

    case WA_ERROR_CODE.RATE_LIMIT:
      // 130429 — SDK retries automatically, but handle at app level if needed
      break;
  }
}
```

**Full catalogue:**

| Constant | Code | Meaning |
|----------|------|---------|
| `OUTSIDE_CUSTOMER_CARE_WINDOW` | 131047 | 24h session expired; use a template |
| `TEMPLATE_NOT_APPROVED` | 132001 | Template pending review or rejected |
| `TEMPLATE_PARAMETER_COUNT_MISMATCH` | 132012 | Wrong number of `{{N}}` params sent |
| `TEMPLATE_TEXT_TOO_LONG` | 132013 | Template text exceeds Meta limit |
| `TEMPLATE_FORMAT_MISMATCH` | 132014 | Component format mismatch |
| `PHONE_NUMBER_NOT_ALLOWED` | 131031 | Sending restrictions on phone number |
| `RECIPIENT_NOT_ON_WHATSAPP` | 131026 | Recipient not registered on WhatsApp |
| `RATE_LIMIT` | 130429 | Rate limit exceeded |
| `SPAM_RATE_LIMIT` | 131048 | Spam rate limit exceeded |

---

## Retry Policy

The default policy retries on:
- Network / transport failures (no HTTP response received)
- HTTP `408` (Request Timeout)
- HTTP `429` (Rate Limit) — respects the `Retry-After` header when present
- HTTP `502`, `503`, `504` (transient upstream errors)

**Defaults:** 3 attempts, 300 ms base delay, 8 s cap, 25% jitter.

```ts
// Customize retry behavior
const wa = new WhatsAppClient(credentials, {
  retryPolicy: {
    maxAttempts: 5,
    baseMs:      500,
    maxMs:       15_000,
    jitterRatio: 0.3,
    retryPredicate: (err) => {
      if (err instanceof Error) return true;          // network error — always retry
      const { httpStatus, code } = err as { httpStatus?: number; code?: number };
      if (code === 131047) return false;              // policy error — never retry
      return httpStatus === 0 || httpStatus === 429 || (httpStatus ?? 0) >= 500;
    },
  },
});

// Disable retries entirely (e.g. for OTPs where duplicates are unacceptable)
const wa = new WhatsAppClient(credentials, { retryPolicy: null });
```

---

## Multi-Account & Multi-Number Support

```ts
const wa = new WhatsAppClient({
  phoneNumberId:     "LINE_1_ID",
  businessAccountId: "WABA_ID",
  accessToken:       token,
});

// Different phone number, same WABA and token
const wa2 = wa.cloneWithPhoneNumberId("LINE_2_ID");
await wa2.messages.sendText({ to: "201001234567", body: "From line 2" });

// Entirely different WABA and credentials
const wa3 = wa.cloneWithCredentials({
  phoneNumberId:     "OTHER_ORG_LINE",
  businessAccountId: "OTHER_WABA",
  accessToken:       otherDecryptedToken,
});

// Read the IDs on any instance
console.log(wa.phoneNumberId);      // "LINE_1_ID"
console.log(wa.businessAccountId);  // "WABA_ID"
```

---

## Phone Number Normalization

The Meta API expects phone numbers as E.164 digits with **no leading `+`** (e.g. `"201001234567"`, not `"+201001234567"`).

```ts
import { normalizeWhatsAppRecipient, tryNormalizeWhatsAppRecipient } from "@WhatsApp/sdk";

// Throws on invalid input
normalizeWhatsAppRecipient("+20 100-123-4567") // → "201001234567"
normalizeWhatsAppRecipient("00201001234567")   // → "201001234567"
normalizeWhatsAppRecipient("201001234567")     // → "201001234567"

// Returns null on failure — safe for form validation
const phone = tryNormalizeWhatsAppRecipient(userInput);
if (!phone) {
  setError("Invalid phone number");
} else {
  await wa.messages.sendText({ to: phone, body: "Hi!" });
}
```

---

## Template Utilities

### Template name derivation

Meta template names must be `snake_case_lowercase`. This helper converts a human-readable display name to a valid submission name:

```ts
import { deriveWhatsAppTemplateSubmissionName } from "@WhatsApp/sdk";

deriveWhatsAppTemplateSubmissionName("Order Shipped!", "507f1f77bcf86cd799439011")
// → "order_shipped"

// Empty name falls back to a prefix + last 12 chars of the provided ID
deriveWhatsAppTemplateSubmissionName("", "507f1f77bcf86cd799439011")
// → "tmpl_799439011"
```

### Language code normalization

Meta may return `en_US`; your storage may use `en`. Normalize before comparing:

```ts
import { normalizeWhatsAppTemplateLanguageCode } from "@WhatsApp/sdk";

normalizeWhatsAppTemplateLanguageCode("en_US") // → "en"
normalizeWhatsAppTemplateLanguageCode("AR")    // → "ar"
normalizeWhatsAppTemplateLanguageCode("ar_SA") // → "ar"
```

### Pre-send validation

Validate template inputs before making any HTTP call:

```ts
import {
  assertTemplateName,
  assertOtpCode,
  textParam,
  TemplateValidationError,
} from "@WhatsApp/sdk";

try {
  assertTemplateName("order_shipped");   // OK
  assertTemplateName("Order Shipped!"); // throws — not snake_case

  assertOtpCode("847213");              // OK
  assertOtpCode("this-is-too-long!!"); // throws — exceeds 15 chars

  const p = textParam("Ahmed Ali");     // → { type: "text", text: "Ahmed Ali" }
} catch (e) {
  if (e instanceof TemplateValidationError) {
    console.error("Validation failed:", e.message);
  }
}
```

---

## TypeScript Type Reference

### Credentials & options

```ts
WhatsAppCredentials          // phoneNumberId, businessAccountId, accessToken
WhatsAppClientOptions        // graphApiVersion, baseUrl, defaultLanguage, fetch, onRequest, retryPolicy
WhatsAppRetryPolicy          // maxAttempts, baseMs, maxMs, jitterRatio, retryPredicate
WhatsAppRequestHook          // (info: { method, path, bodySize? }) => void
```

### Result and errors

```ts
WhatsAppResult<T>            // { ok: true; data: T } | { ok: false; error: WhatsAppGraphError }
WhatsAppGraphError           // httpStatus, message, code?, errorSubcode?, type?, fbtraceId?, retryAfterMs?, raw?
WA_ERROR_CODE                // const catalogue of known Graph error codes
WaErrorCode                  // union of all WA_ERROR_CODE values
```

### Outbound messages

```ts
SendTextParams
SendMediaByUrlParams
SendMediaByIdParams
SendStickerParams
SendReactionParams
SendLocationParams
SendContactsParams
SendInteractiveParams
SendTemplateParams
MarkReadParams
SendTypingParams
WaTemplateComponent
WaSendResult                 // { messageId: string; waId?: string }
```

### Template builders

```ts
SendUtilityTemplateParams
SendMarketingTemplateParams
SendAuthOtpTemplateParams
CreateUtilityTemplateOptions
CreateAuthTemplateOptions
CreateTemplatePayload
CreateTemplateResult         // { templateId: string; status: string; category: string }
```

### Template management

```ts
MetaTemplateRecord           // id, name, language, status, category, components, ...
ListTemplatesParams          // fields?, status?, category?, limit?, after?
DeleteTemplateParams         // name, hsm_id?
```

### Webhook

```ts
ParsedInboundMessage         // messageId, from, profileName, timestamp, type, content
ParsedWebhookEntry           // phoneNumberId, messages[], statuses[]
WaStatusUpdate               // id, recipientId, status, timestamp, errors?
WaInboundContent             // discriminated union — access via msg.type
WaTextContent                // { text: string }
WaMediaContent               // { mediaId: string; mimeType: string; caption?: string; ... }
WaInteractiveContent         // { buttonReply?, listReply? }
WaReactionContent            // { messageId: string; emoji: string }
WaButtonContent              // { payload: string; text: string }
WebhookVerifyParams
WebhookVerifyResult
```

### Phone numbers & profile

```ts
WaPhoneNumberRecord          // id, display_phone_number, quality_rating, verified_name, ...
BusinessProfile              // about, address, description, email, vertical, websites, ...
UpdateBusinessProfileParams
BlockUsersParams             // userPhones: string[]
```

---

## Production Notes

**Token security**
- The SDK expects a plain-text access token. Decrypt it in your service layer before constructing the client.
- The SDK never stores, logs, or otherwise exposes the token. The `onRequest` hook receives only method and path.
- Rotate tokens at the Meta App Dashboard and update your encrypted credential store accordingly.

**24-hour customer care window**
- Free-form messages (text, media, interactive, etc.) can only be sent within 24 hours of the customer's last inbound message.
- Outside this window, Meta returns `code 131047`. Always have a pre-approved Utility template ready as a fallback.
- Check your conversation state before sending and route to `sendUtilityTemplate` proactively to avoid wasted API calls.

**Webhook reliability**
- **Always return HTTP 200 to Meta**, even when internal processing fails. Returning 4xx or 5xx causes Meta to retry the delivery repeatedly.
- Deduplicate inbound messages by `msg.messageId` (WAMID) — Meta may deliver the same event more than once.
- Process inbound messages and status updates **asynchronously** (enqueue them) to avoid blocking Meta's delivery timeout.

**Idempotency for outbound sends**
- The Meta `/messages` endpoint has no built-in idempotency key.
- Before calling the SDK, guard with a short-TTL key (e.g. `hash(templateName + recipientId + contextId)`) checked in your database or cache.

**PII in logs**
- Never log full phone numbers in shared logs. Use the last 4 digits for correlation.
- Always log `fbtraceId` on failures — Meta support requires it for investigations.
- The `error.raw` field contains the verbatim Meta error payload. Strip or mask it before forwarding to external log aggregators.

**Retries**
- The default policy retries network errors, 429, and 5xx up to 3 times.
- `Retry-After` headers are respected automatically on 429 responses.
- Never configure retries for `131047` (policy error) or `132001` (template not approved) — they will not resolve on retry.

**Graph API version**
- Pinned to `v21.0` by default. Override via `graphApiVersion` in options.
- Test version upgrades in a lower environment before changing the pinned version.

---

## Integration Patterns

### CRM / conversation service — send with automatic fallback

```ts
const wa = new WhatsAppClient({
  phoneNumberId:     config.phoneNumberId,
  businessAccountId: config.businessAccountId,
  accessToken:       await decrypt(config.accessToken),
});

const phone = normalizeWhatsAppRecipient(contact.phone);

const result = await wa.messages.sendText({ to: phone, body: agentMessage });

if (!result.ok && result.error.code === WA_ERROR_CODE.OUTSIDE_CUSTOMER_CARE_WINDOW) {
  await wa.sendUtilityTemplate({
    to:           phone,
    templateName: config.freeTextFallbackTemplateName,
    language:     config.freeTextFallbackLanguage,
    bodyParams:   [agentMessage],
  });
}
```

### OTP microservice — retries disabled

```ts
export async function sendOtp(phone: string, code: string): Promise<boolean> {
  // Disable retries: duplicate OTP delivery must never happen
  const wa = new WhatsAppClient(
    { phoneNumberId, businessAccountId, accessToken },
    { retryPolicy: null },
  );

  const normalized = tryNormalizeWhatsAppRecipient(phone);
  if (!normalized) return false;

  const result = await wa.sendAuthOtp({
    to:           normalized,
    templateName: "verify_otp",
    language:     "en",
    otpCode:      code,
  });

  return result.ok;
}
```

### Notification service — bulk utility templates

```ts
async function notifyOrdersShipped(orders: Order[]) {
  const wa = new WhatsAppClient(credentials);

  const results = await Promise.allSettled(
    orders.map((order) =>
      wa.sendUtilityTemplate({
        to:           normalizeWhatsAppRecipient(order.customerPhone),
        templateName: "order_shipped",
        language:     "ar",
        bodyParams:   [order.id, order.estimatedDelivery],
      })
    ),
  );

  for (const [i, r] of results.entries()) {
    if (r.status === "fulfilled" && !r.value.ok) {
      console.error(`Order ${orders[i].id} failed:`, r.value.error.code);
    }
  }
}
```

### Webhook processor with async queue

```ts
app.post("/webhook", async (req, res) => {
  const raw = req.rawBody;

  if (appSecret && !verifyWebhookSignature(raw, req.headers["x-hub-signature-256"], appSecret)) {
    return res.status(200).json({ ok: true }); // silently reject — still 200
  }

  const payload = JSON.parse(raw);
  if (!isWhatsAppWebhookPayload(payload)) return res.status(200).json({ ok: true });

  for (const entry of payload.entry) {
    const parsed = parseWebhookEntry(entry);

    for (const msg of parsed.messages) {
      await queue.enqueue("wa:inbound", { phoneNumberId: parsed.phoneNumberId, msg });
    }
    for (const status of parsed.statuses) {
      await queue.enqueue("wa:status", status);
    }
  }

  res.status(200).json({ ok: true });
});
```

---

## What Is Out of Scope

The SDK deliberately excludes the following. These belong in the consuming service:

| Concern | Where it belongs |
|---------|-----------------|
| Token encryption / decryption | Your service's secret management layer |
| Storing messages, conversations, contacts | Your database models |
| RBAC / organization checks | Your auth middleware |
| Queue / job management | Your worker infrastructure |
| HTTP route registration | Your framework (Oak, Hono, Fresh, etc.) |
| Subscriber opt-in enforcement | Your compliance layer |
| SLA timers, auto-assignment, escalation | Your CRM business logic |
| Webhook HTTP server | Your service (use SDK helpers for verify + parse) |

---

## References (`docs/`)

Supplementary material lives under [`docs/`](./docs/) next to this README. Use it for deeper architecture notes, migration context, and the Meta-aligned Postman collection.

| File | Description |
|------|-------------|
| [`docs/01-current-system-inventory.md`](./docs/01-current-system-inventory.md) | Inventory of the legacy host integration: main files, flows, secrets, and known gaps before the SDK. |
| [`docs/02-package-architecture-and-api.md`](./docs/02-package-architecture-and-api.md) | Package layout, `WhatsAppClient` API shape, configuration boundaries, and dependency rules (no persistence in the SDK). |
| [`docs/03-meta-api-template-categories-and-postman-map.md`](./docs/03-meta-api-template-categories-and-postman-map.md) | Utility / Marketing / Authentication categories, payload concerns, and alignment with Meta’s Cloud API + Postman flows. |
| [`docs/04-errors-retries-idempotency-logging.md`](./docs/04-errors-retries-idempotency-logging.md) | Structured errors, retry and `Retry-After` behaviour, idempotency expectations, and observability / PII hygiene. |
| [`docs/05-tasker-migration-checklist.md`](./docs/05-tasker-migration-checklist.md) | Phased checklist for adopting this SDK inside the original host app (import map → shims → call sites). |
| [`docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json`](./docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json) | Curated Postman collection for Cloud API: messages, templates, billing-related endpoints, phone numbers, and registration. Import into Postman or use as a request catalogue alongside the SDK. |
