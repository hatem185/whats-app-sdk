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
  - [Order confirmation and delivery address](#order-confirmation-and-delivery-address)
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
    - [Handling order confirmation replies](#handling-order-confirmation-replies-delivery-address-or-location)
15. [Error Handling](#error-handling)
  - [Meta Graph error envelope](#meta-graph-error-envelope)
  - [SDK types (`GraphErrorPayload`, …)](#sdk-types-grapherrorpayload-grapherrorenvelope-whatsappgrapherror)
  - [How the SDK maps errors (`parseMetaError`, `wrapNetworkError`)](#how-the-sdk-maps-errors-parsemetaerror-wrapnetworkerror)
  - [Rate limiting / `Retry-After`](#rate-limiting--retry-after)
  - [`defaultRetryPredicate`](#defaultretrypredicate--when-retries-are-reasonable)
  - [Scenario reference](#scenario-reference)
  - [`WA_ERROR_CODE` catalogue](#wa_error_code-catalogue)
  - [Debugging checklist](#debugging-checklist)
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


| Category                | Capability                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Messaging**           | Text, image, video, audio, document, sticker, reaction, location, contacts, interactive  |
| **Templates**           | Send utility, marketing, and authentication / OTP templates                              |
| **Template builders**   | High-level helpers that assemble `components` arrays automatically                       |
| **Template management** | Create, list (single page + all pages), delete                                           |
| **Template validation** | Pre-send arity checks, OTP code length, name format validation                           |
| **Template utilities**  | Derive submission names, normalize language codes                                        |
| **Media**               | Upload to WhatsApp media store, download by URL, delete                                  |
| **Webhook**             | Challenge verification (GET) and HMAC-SHA256 signature validation (POST)                 |
| **Webhook parsing**     | Pure inbound message parser — text, media, interactive, reaction, order, unknown         |
| **Phone numbers**       | List phone numbers registered to a WABA                                                  |
| **Business profile**    | Read and update the WhatsApp Business Profile                                            |
| **User moderation**     | Block and unblock users                                                                  |
| **Error handling**      | Structured `WhatsAppGraphError` with `code`, `errorSubcode`, `fbtraceId`, `retryAfterMs` |
| **Known error codes**   | `WA_ERROR_CODE` catalogue (131047, 132001, 130429, and more)                             |
| **Retries**             | Exponential backoff + jitter, `Retry-After` header support, configurable predicate       |
| **Multi-account**       | Clone client with a different phone number or full credentials                           |
| **TypeScript**          | Complete types for all inputs, outputs, and webhook shapes                               |
| **No env coupling**     | The SDK never reads `Deno.env` — caller passes credentials explicitly                    |


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
});wa.media.upload

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

### Order confirmation and delivery address

A common **Utility** flow after checkout:

1. Your backend creates the order, then sends an **approved** utility template that names the store, summarizes line items and total, and asks the customer to **reply with a delivery address**, **share a location pin**, or **describe a pickup point**.
2. The customer answers inside WhatsApp (free-form **text** or a **location** message).
3. Your **webhook** receives that inbound message; you match it to the open order (usually by **sender `from`** — the customer’s WA ID — and optionally **`context.id`** if they tapped “reply” on your template message).

Meta does not parse the address for you — you store whatever the customer sends and validate it in your own domain.

**1. Define the template (submit once; Meta must approve)** — body uses four placeholders: store name, order reference, product summary, formatted total. The closing instruction is **fixed copy** in the template (not a variable), so reviewers see the full UX.

```ts
import { buildUtilityTemplatePayload } from "@WhatsApp/sdk";

const payload = buildUtilityTemplatePayload({
  name:         "order_confirm_address",
  language:     "en",
  bodyText:
    "Thank you for ordering from {{1}}.\n" +
    "Order {{2}}\n" +
    "Items: {{3}}\n" +
    "Total: {{4}}\n\n" +
    "To confirm delivery, reply with your full address, send a location pin, or describe where we should deliver.",
  bodyExamples: [
    "Desert Bloom Store",
    "ORD-20491",
    "2× Olive oil 500ml, 1× Honey jar",
    "$124.00",
  ],
  footerText: "Reply with your delivery details.",
});

await wa.templates.create(payload);
```

Adjust field names if your Meta workspace requires a different language code or footer length (**footer ≤ 60 characters**). The helper fixes **`category: UTILITY`** internally — see [Create Templates](#create-templates).

**2. Send the template when the order is created**

```ts
const sendResult = await wa.sendUtilityTemplate({
  to:           "201001234567", // customer WhatsApp (E.164 digits, no +)
  templateName: "order_confirm_address",
  language:     "en",
  bodyParams: [
    "Desert Bloom Store",
    "ORD-20491",
    "2× Olive oil 500ml, 1× Honey jar",
    "USD 124.00",
  ],
});

if (sendResult.ok) {
  // Persist sendResult.data.messageId with your order row — optional but useful:
  // inbound replies may include msg.context.id === this WAMID when user replies to the template.
  await db.orders.update(orderId, {
    confirmationTemplateWamId: sendResult.data.messageId,
    confirmationSentAt:        new Date(),
  });
}
```

**3. Handle the reply in the webhook** — see [Handling order confirmation replies](#handling-order-confirmation-replies-delivery-address-or-location).

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

### Handling order confirmation replies (delivery address or location)

After you send [order confirmation template](#order-confirmation-and-delivery-address), customers typically answer with:

- **`type: "text"`** — street, building, landmarks (your template asked them to describe the drop-off).
- **`type: "location"`** — GPS pin (`latitude`, `longitude`, optional `name` / `address` from WhatsApp).

**Correlation strategy**

1. **Primary:** map **`msg.from`** (customer WA ID, digits without `+`) to the **most recent open order** awaiting delivery details (or to an explicit state machine: `AWAITING_ADDRESS`).
2. **Optional:** if the user tapped **Reply** on your template bubble, **`msg.context?.id`** may equal the **`messageId`** (WAMID) you stored when you sent the template — use that to disambiguate when one customer has multiple pending orders.

```ts
import type { ParsedInboundMessage } from "@WhatsApp/sdk";

async function handleOrderConfirmationReply(
  msg: ParsedInboundMessage,
): Promise<void> {
  const customerWaId = msg.from;
  const order = await findOrderAwaitingAddress(customerWaId, msg.context?.id);
  if (!order) return;

  if (msg.type === "text") {
    const { text } = msg.content;
    await db.orders.update(order.id, {
      deliveryAddressText: text.trim(),
      addressConfirmedAt:  new Date(),
    });
    await notifyWarehouse(order.id);
    return;
  }

  if (msg.type === "location") {
    const { latitude, longitude, name, address } = msg.content;
    await db.orders.update(order.id, {
      deliveryLatitude:  latitude,
      deliveryLongitude: longitude,
      deliveryLocationName: name,
      deliveryLocationAddress: address,
      addressConfirmedAt: new Date(),
    });
    await notifyWarehouse(order.id);
    return;
  }

  // Template quick-reply buttons surface as msg.type === "button" (WaButtonContent)
  if (msg.type === "button") {
    const { payload, text } = msg.content;
    // Branch on payload you defined in the template, if you add buttons later
  }
}
```

Call `handleOrderConfirmationReply` from your webhook loop. Offload persistence and outbound replies to a **queue or worker** so the HTTP handler still returns **HTTP 200** to Meta immediately (see [Production Notes](#production-notes)).

```ts
for (const msg of messages) {
  if (await shouldTreatAsDeliveryReply(msg)) {
    void worker.enqueue(() => handleOrderConfirmationReply(msg));
    continue;
  }
  // …other handlers
}
```

Implement **`shouldTreatAsDeliveryReply`** in your domain — for example: order row in `AWAITING_ADDRESS`, or `msg.context?.id` matches a stored template WAMID. If you also send **interactive** confirmations ([interactive messages](#interactive-messages)), handle **`msg.type === "interactive"`** and read **`buttonReply`** / **`listReply`**.

---

## Error Handling

Every **`WhatsAppClient`** call that goes through **`WhatsAppHttpClient.request()`** (messages, templates CRUD, profile, phone list, block/unblock, and similar Graph JSON endpoints) returns **`WhatsAppResult<T>`** — failures are **`{ ok: false, error: WhatsAppGraphError }`**, not thrown exceptions. Pure helpers (**webhook** verification / parsing, **phone normalization**, payload builders that do not call the network) use different return types or throw only for local validation.

**Exceptions:** synchronous helpers such as template arity / OTP validation throw `TemplateValidationError` **before** any HTTP call.

Meta documents WhatsApp Cloud API error semantics in the [WhatsApp Cloud API — Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) guide. General Graph envelope behaviour (OAuth `OAuthException`, `fbtrace_id`, etc.) is described in [Graph API — Error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/). Those references are authoritative; **this README does not reproduce Meta’s full code list**, which can change over time.

### End-to-end flow

1. **`fetch`** returns an HTTP status and a response body (Graph failures almost always include JSON with a top-level `error` key).
2. **`WhatsAppHttpClient.request`** (backing `get` / `post` / `put` / `delete`) parses JSON. When **`response.ok`** is false, it builds a **`WhatsAppGraphError`** via **`parseMetaError(httpStatus, body, retryAfterMs)`**, where **`retryAfterMs`** comes from the **`Retry-After`** header when Meta sends one ([`client.ts`](client.ts)).
3. When **`retryPolicy`** is not `null`, the implementation wraps calls in **`withRetry`** ([`retry.ts`](retry.ts)): if **`retryPredicate`** (default **`defaultRetryPredicate`**) returns **true**, the error is treated as transient — the client sleeps (honouring **`retryAfterMs`** when present, otherwise exponential backoff + jitter) and retries up to **`maxAttempts`**. **`retryAfterMs`** is **capped by `retryPolicy.maxMs`** on each wait.
4. If retries are exhausted or the predicate returns **false**, the caller receives **`{ ok: false, error }`** with the last **`WhatsAppGraphError`**.
5. When **`fetch`** throws before any HTTP response (DNS, TLS, timeout, abort), the SDK uses **`wrapNetworkError`** → **`httpStatus: 0`**, **`message`** from the thrown **`Error`**.

### Meta Graph error envelope

Successful Graph JSON responses return your resource directly. Failures typically use a **top-level `error` object**:

```json
{
  "error": {
    "message": "Invalid OAuth access token - Cannot parse access token",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "error_data": "{\"blame_field_specs\":[[\"access_token\"]]}",
    "fbtrace_id": "AbcD1eFgHiJkLmNoPqRsTuVwXyZ"
  }
}
```

- **`message`** — Human-readable description (often includes a `(#code)` prefix for application errors).
- **`type`** — Error class, frequently `"OAuthException"` for permission / token problems.
- **`code`** — Primary Graph / product error number (branch on this first).
- **`error_subcode`** — Optional refinement (OAuth subcodes, throttling variants, etc. — see Meta’s tables).
- **`error_data`** — Optional extra detail. [`GraphErrorPayload`](types/graph.ts) types this as an optional **string**; Meta may still attach **additional keys** on the `error` object that are not declared in that interface — inspect the runtime JSON when debugging.
- **`fbtrace_id`** — Correlation ID for Meta support and internal tracing.

HTTP status is **not** inside the JSON body; you read it from the response status line (the SDK stores it as `WhatsAppGraphError.httpStatus`).

### SDK types (`GraphErrorPayload`, `GraphErrorEnvelope`, `WhatsAppGraphError`)

| Type | Role |
| ---- | ---- |
| `GraphErrorPayload` | Shape of the inner `error` object Meta returns (`message`, optional `code`, `error_subcode`, `type`, `error_data`, `fbtrace_id`). |
| `GraphErrorEnvelope` | Wrapper `{ "error": GraphErrorPayload }` matching the common Graph failure JSON. |
| `WhatsAppGraphError` | Normalized error **your app reads** from `result.error` on every failed SDK call. |

**`WhatsAppGraphError` fields**

| Field | Source | How integrators use it |
| ----- | ------ | ---------------------- |
| `httpStatus` | HTTP status from `fetch` | Distinguish transport vs HTTP; pair with `code` for logic. |
| `message` | `error.message`, or synthesized `WhatsApp API error — HTTP {status}` if JSON is missing / malformed | User-facing or log summary (avoid echoing raw Graph text to end users verbatim). |
| `code` | `error.code` | Primary branch key; compare to `WA_ERROR_CODE` where applicable. |
| `errorSubcode` | `error.error_subcode` | Finer-grained OAuth / policy variants documented by Meta. |
| `type` | `error.type` | Often `"OAuthException"`; useful in logs and dashboards. |
| `fbtraceId` | `error.fbtrace_id` | **Attach to Meta support tickets** and internal incident timelines. |
| `raw` | Verbatim parsed `error` object (may be partial) | Forensics; **strip tokens / PII** before shipping to third-party log platforms. |
| `retryAfterMs` | Parsed from `Retry-After` response header when present | Hint for backoff; populated on throttling responses (see below). |

### How the SDK maps errors (`parseMetaError`, `wrapNetworkError`)

- **`parseMetaError(httpStatus, body, retryAfterMs?)`** ([`errors/graph_error.ts`](errors/graph_error.ts)) — Parses JSON `body`, extracts `body.error`, and fills `WhatsAppGraphError`. If `body` is not a Graph error envelope, `message` falls back to `WhatsApp API error — HTTP {httpStatus}` and `code` / `fbtraceId` may be absent. Exported from `@WhatsApp/sdk` for tests or custom HTTP glue.
- **`wrapNetworkError(err)`** — Converts a thrown network / `fetch` failure into `{ httpStatus: 0, message: err.message }`. **`httpStatus === 0` means no HTTP response was received** (DNS, TLS, timeout, aborted request, etc.).
- **JSON requests** (`WhatsAppHttpClient.request`, used by `get` / `post` / `put` / `delete`): on non-OK HTTP status, the client calls `parseMetaError` and passes **`retryAfterMs`** when [`Retry-After`](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3) is present (integer seconds or HTTP-date — see [`parseRetryAfterHeader` in `client.ts`](client.ts)).
- **Multipart media upload** (`requestForm` / `wa.media.upload`): uses `parseMetaError` on failure but **does not** attach retry policy or `Retry-After` parsing (single attempt).
- **Media binary download** (`requestBinary` / `wa.media.download`): same — **no automatic retries**.
- **Template `listAll` pagination** (`listAllTemplates`): follows `paging.next` with plain `fetch` — **no** SDK retry wrapper on individual pages.

### Rate limiting / `Retry-After`

Graph applications may receive **HTTP `429`** or other throttling signals. Meta’s platform-wide guidance lives under [Graph API — Rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). WhatsApp also enforces [**messaging limits** and quality](https://developers.facebook.com/docs/whatsapp/messaging-limits) per phone number tier — those surface as WhatsApp-specific `code` values (see Meta’s error-code guide), not only as HTTP 429.

When Meta returns **`Retry-After`**, this SDK parses it into **`WhatsAppGraphError.retryAfterMs`**. The default retry scheduler uses that value when deciding wait time (capped by `retryPolicy.maxMs` — default **8000 ms**).

**Constants:** `WA_ERROR_CODE.RATE_LIMIT` (**130429**) and `WA_ERROR_CODE.SPAM_RATE_LIMIT` (**131048**) are included in this package for convenience; Meta’s list is **non-exhaustive** — always consult the official error-code documentation for additions.

### `defaultRetryPredicate` — when retries are reasonable

[`defaultRetryPredicate`](errors/graph_error.ts) returns **true** (eligible for another attempt) when:

| Condition | Rationale |
| --------- | --------- |
| `err instanceof Error` | Treated as pre-`parseMetaError` transport failure inside `withRetry`. |
| `httpStatus === 0` | No HTTP response (`wrapNetworkError`). |
| `httpStatus` is `408`, `429`, `502`, `503`, or `504` | Timeouts, explicit throttling, or transient upstream errors. |

**All other parsed Graph errors return false** — e.g. `131047` (customer care window), `132001` (template not approved), `131026` (recipient not on WhatsApp), invalid parameters, OAuth `190`, etc. **Retrying will not fix these** until your integration or Meta configuration changes.

Override via `WhatsAppClientOptions.retryPolicy.retryPredicate` when you need stricter or looser rules (see [Retry Policy](#retry-policy)).

### Scenario reference

Typical HTTP status, Graph `code`, and remediation patterns vary by account state and API version. Use the tables below as **orientation**; verify against Meta’s docs when debugging production traffic.

#### OAuth / access token failures

| Topic | Typical signal | SDK surface | Integrator remediation |
| ----- | -------------- | ----------- | --------------------- |
| Invalid / malformed token | HTTP **401** or **400**, `type` often `"OAuthException"`, Graph **`code` 190** with documented **`error_subcode`** ([Graph error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/)) | `WhatsAppGraphError.code`, `errorSubcode`, `type`, `fbtraceId` | Regenerate token in Meta App Dashboard; confirm **WhatsApp product** permissions; fix clock skew if using short-lived tokens. |
| Expired session | Same family as 190 / OAuth subcodes | As above | Refresh long-lived tokens; rotate System User tokens per Meta guidance. |
| Missing permission / feature | OAuth or permission errors (`code` **10**, **200**, etc. — see Meta tables) | `code`, `message`, `raw` | Grant `whatsapp_business_messaging`, `whatsapp_business_management`, etc.; complete App Review where required. |

```json
{
  "error": {
    "message": "Error validating access token: Session has expired on example-date...",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "fbtrace_id": "An0nym1z3dTr4c31dValu3xxxxx"
  }
}
```

The **`error_subcode`** above is **illustrative** — OAuth **`190`** has multiple documented subcodes; use Meta’s [Graph API — Error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/) tables for authoritative mappings.

#### Rate limiting & throughput

| Topic | Typical signal | Constants / SDK | Remediation |
| ----- | -------------- | ----------------- | ----------- |
| Graph / HTTP throttling | HTTP **429**, optional `Retry-After` → `retryAfterMs` | `defaultRetryPredicate` retries; honour backoff | Slow down senders; shard across numbers only where policy allows; see [Rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). |
| WhatsApp messaging caps | WhatsApp-specific `code`s (e.g. **130429**, **131048** — see [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)) | `WA_ERROR_CODE.RATE_LIMIT`, `SPAM_RATE_LIMIT` | Upgrade tier, improve quality rating, reduce spam complaints; adjust campaign design. |

#### Recipient / phone number issues

| Topic | Typical signal | SDK constant | Remediation |
| ----- | -------------- | ------------ | ----------- |
| Not on WhatsApp | Meta documents **`131026`** for undeliverable / not-on-WhatsApp cases ([Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)) | `WA_ERROR_CODE.RECIPIENT_NOT_ON_WHATSAPP` | Validate opt-in; remove dead numbers; use webhook delivery `failed` statuses for hygiene. |
| Bad input format | Often **400** with parameter validation `code` **100** or subcodes (see Meta) | — | Use `normalizeWhatsAppRecipient()` before sending; never pass `+` prefix. |
| User blocked your business | Documented WhatsApp failure codes / statuses ([Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)) | Compare `result.error.code` and webhook status errors | Respect opt-out; surface in CRM. |
| Phone number sending restrictions | **`131031`** per SDK catalogue (aligned with Meta’s “restrictions on how many messages can be sent” wording) | `WA_ERROR_CODE.PHONE_NUMBER_NOT_ALLOWED` | Check number registration, limits, and policy in Business Manager. |

#### Template errors

| Topic | Typical signal | SDK constant | Remediation |
| ----- | -------------- | ------------ | ----------- |
| Not approved / wrong name / language | **`132001`** | `WA_ERROR_CODE.TEMPLATE_NOT_APPROVED` | Wait for approval or fix rejection; align `templateName` + `language` with approved records (`wa.templates.list`). |
| Parameter count mismatch | **`132012`** | `WA_ERROR_CODE.TEMPLATE_PARAMETER_COUNT_MISMATCH` | Match `{{N}}` placeholders to `components` parameters. |
| Text too long | **`132013`** | `WA_ERROR_CODE.TEMPLATE_TEXT_TOO_LONG` | Shorten dynamic segments. |
| Format mismatch | **`132014`** | `WA_ERROR_CODE.TEMPLATE_FORMAT_MISMATCH` | Align currency / date-time / component types with template definition. |
| Content / policy rejection | **400** responses during **template creation** or **`REJECTED`** status from Meta | `rejection_reason` on template records | Edit template per Meta Business Policy; see [Message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/). |

#### Messaging policy / conversation window

| Topic | Typical signal | SDK constant | Remediation |
| ----- | -------------- | ------------ | ----------- |
| Outside 24-hour customer care session | **`131047`** | `WA_ERROR_CODE.OUTSIDE_CUSTOMER_CARE_WINDOW` | Send an **approved Utility / Authentication / Marketing** template according to opt-in and category rules; resume free-form text after user replies. |
| Marketing / utility constraints | Additional WhatsApp codes documented under [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) | Compare `code` / webhook errors | Follow [Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) (hub for utility vs marketing vs authentication) and your opt-in / consent obligations per Meta policy. |

#### Media / attachments

| Topic | Typical signal | SDK behaviour | Remediation |
| ----- | -------------- | ------------- | ----------- |
| Upload failure | **400** / **4xx** with Graph `error` object | `wa.media.upload` → `parseMetaError`; **no auto-retry** | Confirm MIME type, size limits, and supported formats ([Media](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)); re-upload file bytes. |
| Invalid **`mediaId`** or expired handle | Documented WhatsApp codes ([Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)) | `sendMediaById` failures surface like any `/messages` error | Re-upload to obtain a fresh `mediaId`. |
| Hosted **`link`** unreachable / bad format | Parameter / media validation errors per Meta | — | Verify HTTPS URL, TLS certificate, content-type, and size limits. |
| Download URL issues | Non-OK fetch from CDN URL | `parseMetaError` on JSON error body; **no retries** | Call `getInfo` again for a fresh URL (`url` is short-lived). |

#### Account / WABA / phone number configuration

| Topic | Typical signal | SDK constant | Remediation |
| ----- | -------------- | ------------ | ----------- |
| Sending restrictions on the business line | **`131031`** | `WA_ERROR_CODE.PHONE_NUMBER_NOT_ALLOWED` | Verify phone registration, display name approval, and policy status in [Business Management](https://developers.facebook.com/docs/whatsapp/overview/business-accounts/). |
| Wrong `phone_number_id` / mismatched token | Often **403** / OAuth family | `code` **190**, **10**, etc. | Align `WhatsAppCredentials.phoneNumberId` with the token’s granted assets. |

### `WA_ERROR_CODE` catalogue

These constants mirror the **non-exhaustive** list described in [`types/graph.ts`](types/graph.ts). **Do not assume every production error appears here** — unknown `code` values should still be logged with `fbtraceId`.

```ts
import { WA_ERROR_CODE } from "@WhatsApp/sdk";

if (!result.ok) {
  switch (result.error.code) {
    case WA_ERROR_CODE.OUTSIDE_CUSTOMER_CARE_WINDOW:
      await sendFallbackTemplate(to);
      break;

    case WA_ERROR_CODE.TEMPLATE_NOT_APPROVED:
      break;

    case WA_ERROR_CODE.RECIPIENT_NOT_ON_WHATSAPP:
      break;

    case WA_ERROR_CODE.RATE_LIMIT:
      break;
  }
}
```

| Constant | Code | Meaning |
| -------- | ---- | ------- |
| `OUTSIDE_CUSTOMER_CARE_WINDOW` | 131047 | Re-engagement / free-form message outside the customer care window — use an approved template. |
| `TEMPLATE_NOT_APPROVED` | 132001 | Template missing, pending, rejected, or wrong name/language for this WABA. |
| `TEMPLATE_PARAMETER_COUNT_MISMATCH` | 132012 | Template placeholder count does not match supplied parameters. |
| `TEMPLATE_TEXT_TOO_LONG` | 132013 | Dynamic template text exceeds Meta limits. |
| `TEMPLATE_FORMAT_MISMATCH` | 132014 | Parameter format does not match template definition. |
| `PHONE_NUMBER_NOT_ALLOWED` | 131031 | Restrictions on outbound volume / eligibility for this phone number. |
| `RECIPIENT_NOT_ON_WHATSAPP` | 131026 | Recipient cannot receive WhatsApp messages on this number. |
| `RATE_LIMIT` | 130429 | Rate limit exceeded. |
| `SPAM_RATE_LIMIT` | 131048 | Spam-oriented rate limit exceeded. |

### Practical consumption example

```ts
const result = await wa.messages.sendText({ to: "201001234567", body: "Hi" });

if (!result.ok) {
  const err = result.error;

  console.error(`HTTP ${err.httpStatus} — ${err.message}`);
  console.error(`Graph code:    ${err.code}`);
  console.error(`Subcode:       ${err.errorSubcode}`);
  console.error(`Error type:    ${err.type}`);
  console.error(`FB trace ID:   ${err.fbtraceId}`);
  console.error(`Retry after:   ${err.retryAfterMs} ms (if set)`);
}
```

### Debugging checklist

1. **Log structured fields**, not entire HTTP dumps — never write `Authorization` headers or access tokens to logs.
2. **Persist `fbtrace_id`** (`WhatsAppGraphError.fbtraceId`) alongside your internal request ID when opening a Meta support case.
3. **Correlate webhook `failed` statuses** (`status.errors[].code`) with outbound `/messages` failures — the same WhatsApp codes often appear in both paths.
4. **Inspect `error.raw` sparingly** in secure environments; redact before forwarding to external vendors.
5. **`httpStatus === 0`** → infrastructure / client-side issue first (DNS, TLS, firewall, timeout); **`httpStatus >= 400` with Graph JSON** → token, payload, or policy issue first.
6. **`retryAfterMs` present** → throttle-aware backoff; remember **`maxMs` caps** server hints in the default retry helper ([`retry.ts`](retry.ts)).
7. For **codes not covered by `WA_ERROR_CODE`**, branch on numeric `code` from Meta’s documentation and add constants in your app if needed.

---

## Retry Policy

Errors are normalized as described in [Error Handling](#error-handling). This section focuses on **when** the SDK repeats a failed JSON request.

Retries are implemented inside **`withRetry`** ([`retry.ts`](retry.ts)) using **`DEFAULT_RETRY_POLICY`** unless you override or disable **`retryPolicy`** on the client. **`withRetry` itself is not exported** from `@WhatsApp/sdk` — configure behaviour via **`WhatsAppClientOptions.retryPolicy`**.

**Where retries apply:** `WhatsAppHttpClient.request()` (used by most `wa.*` calls). **No automatic retries** for `requestForm` (media upload), `requestBinary` (media download), or manual pagination inside `listAllTemplates`.

The default policy retries on:

- Network / transport failures (no HTTP response received → `httpStatus === 0` after `wrapNetworkError`)
- HTTP `408` (Request Timeout)
- HTTP `429` (Rate Limit) — uses `Retry-After` via `WhatsAppGraphError.retryAfterMs` when present (capped by `maxMs`)
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
GraphErrorPayload            // Inner Meta `error` object — message, code?, error_subcode?, type?, error_data?, fbtrace_id?
GraphErrorEnvelope           // { error: GraphErrorPayload }
WhatsAppResult<T>            // { ok: true; data: T } | { ok: false; error: WhatsAppGraphError }
WhatsAppGraphError           // httpStatus, message, code?, errorSubcode?, type?, fbtraceId?, retryAfterMs?, raw?
WA_ERROR_CODE                // const catalogue of known Graph error codes (non-exhaustive vs Meta)
WaErrorCode                  // union of all WA_ERROR_CODE values

// Exported helpers (@WhatsApp/sdk)
parseMetaError               // (httpStatus, body, retryAfterMs?) => WhatsAppGraphError
wrapNetworkError             // (unknown) => WhatsAppGraphError — transport failures → httpStatus 0
defaultRetryPredicate        // predicate used by the default retryPolicy; safe to reuse in custom policies
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

- JSON requests use **`withRetry`** internally (see [Retry Policy](#retry-policy)); media upload/download and `listAllTemplates` pagination do **not**.
- The default policy retries network errors (`httpStatus === 0`), HTTP **408**, **429**, and **502–504** up to **3** attempts.
- When Meta sends **`Retry-After`**, the wait honours **`WhatsAppGraphError.retryAfterMs`** but **never exceeds `retryPolicy.maxMs`** per attempt (default **8000 ms**).
- Never configure retries for **`131047`** (policy / customer care window) or **`132001`** (template not approved) — **`defaultRetryPredicate`** already skips non-transient HTTP statuses; extend custom predicates if you map Graph **`code`** explicitly.

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


| Concern                                   | Where it belongs                                  |
| ----------------------------------------- | ------------------------------------------------- |
| Token encryption / decryption             | Your service's secret management layer            |
| Storing messages, conversations, contacts | Your database models                              |
| RBAC / organization checks                | Your auth middleware                              |
| Queue / job management                    | Your worker infrastructure                        |
| HTTP route registration                   | Your framework (Oak, Hono, Fresh, etc.)           |
| Subscriber opt-in enforcement             | Your compliance layer                             |
| SLA timers, auto-assignment, escalation   | Your CRM business logic                           |
| Webhook HTTP server                       | Your service (use SDK helpers for verify + parse) |


---

## References (`docs/`)

Supplementary material lives under `[docs/](./docs/)` next to this README. Use it for deeper architecture notes, migration context, and the Meta-aligned Postman collection.


| File                                                                                                                                                                                                                               | Description                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[docs/01-current-system-inventory.md](./docs/01-current-system-inventory.md)`                                                                                                                                                     | Inventory of the legacy host integration: main files, flows, secrets, and known gaps before the SDK.                                                                                            |
| `[docs/02-package-architecture-and-api.md](./docs/02-package-architecture-and-api.md)`                                                                                                                                             | Package layout, `WhatsAppClient` API shape, configuration boundaries, and dependency rules (no persistence in the SDK).                                                                         |
| `[docs/03-meta-api-template-categories-and-postman-map.md](./docs/03-meta-api-template-categories-and-postman-map.md)`                                                                                                             | Utility / Marketing / Authentication categories, payload concerns, and alignment with Meta’s Cloud API + Postman flows.                                                                         |
| `[docs/04-errors-retries-idempotency-logging.md](./docs/04-errors-retries-idempotency-logging.md)`                                                                                                                                 | Structured errors, retry and `Retry-After` behaviour, idempotency expectations, and observability / PII hygiene.                                                                                |
| `[docs/05-tasker-migration-checklist.md](./docs/05-tasker-migration-checklist.md)`                                                                                                                                                 | Phased checklist for adopting this SDK inside the original host app (import map → shims → call sites).                                                                                          |
| `[docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json](./docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json)` | Curated Postman collection for Cloud API: messages, templates, billing-related endpoints, phone numbers, and registration. Import into Postman or use as a request catalogue alongside the SDK. |


