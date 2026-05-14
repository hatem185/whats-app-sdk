# 03 — Meta Cloud API: template categories & Postman alignment

Official references (keep links current when implementing):

- [WhatsApp Cloud API — Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- [Message templates (Business Management)](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Authentication templates + OTP buttons](https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates)

## Repo Postman artifact

Filtered collection (Messages, Templates, Billing, Phone Numbers, Registration descriptions / examples):

[`docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json`](../../../docs/WhatsApp_Cloud_API_Selected_Messages_Templates_Billing_PhoneNumbers_Registration.postman_collection.json)

Useful variables in that collection: **`{{Version}}`, `{{Phone-Number-ID}}`, `{{WABA-ID}}`, `{{Recipient-Phone-Number}}`, `{{User-Access-Token}}`**.

---

## How categories map operationally

| Meta category | Create template (`POST .../message_templates`) | Send (`POST .../phone_number_id/messages` `type: template`) |
|---------------|------------------------------------------------|------------------------------------------------------------|
| **UTILITY** | `"category": "UTILITY"` in create body | Approved template `name` + `language.code` + `components` params |
| **MARKETING** | `"category": "MARKETING"` | Same send path; obey regional marketing / subscriber rules (outside SDK unless optional hooks) |
| **AUTHENTICATION** | `"category": "AUTHENTICATION"` — body/footer/buttons shaped per Meta (OTP **`COPY_CODE`**, **`ONE_TAP`**) | **`template`** + **`components`**: OTP code parameter per send-time docs |

Tasker **`models/crmTemplate.ts`** stores CRM-side category as **`utility` \| `marketing` \| `authentication`** (lowercase) and **`controllers/crmTemplates.ts`** uppercases for Meta **`category`** — the SDK builders should mirror that contract.

---

## Sending (current Tasker mechanics)

**`WhatsAppService.sendTemplateMessage`** forwards:

- `template.name`
- `template.language.code`
- optional `template.components`

No category field on **send** — category is enforced at **approval** time on Meta. The **`sendUtilityTemplate` / `sendMarketingTemplate` / `sendAuthenticationOtp`** SDK names are **developer intent**, not separate HTTP endpoints.

### Authentication / OTP specifics

Postman entries under **Templates → Create authentication template …** illustrate:

- `BODY` — optional **`add_security_recommendation`**
- `FOOTER` — **`code_expiration_minutes`**
- **`BUTTONS`** — **`OTP`** with **`otp_type`**: **`COPY_CODE`** or **`ONE_TAP`** (plus **`package_name`** / **`signature_hash`** when one-tap)

**Send-side** payloads must align with WhatsApp docs for injecting the **time-limited code** into authentication templates (`components` typing — implement per latest Cloud API docs when coding).

Include **escape hatch** **`sendRawTemplate`** for catalogs / MPM / future Meta features present in Postman folders without premature CRM coupling.

---

## Phone number formatting

Postman emphasizes **digits without `+`** for **`to`** in many samples. Tasker forwards **`contact.phone || contact.whatsappId`** unchanged.

SDK should expose **`normalizeWhatsAppRecipient(phoneLike: string)`**:

- Strip spaces/dashes/`+`.
- Optionally validate **`E.164`** length. **Do not silently drop country codes.**

---

## Other Postman folders (optional SDK scope)

Billing / Registration subfolders mainly support **BSP onboarding**. For pure Cloud API outbound notification services they are **nice-to-have** later:

- **Phone numbers**: list / request verification aligns with **`GET /{WABA}/phone_numbers`** (already in **`WhatsAppService.getPhoneNumbers`**).
- Registration flows may belong in **`whatsapp-sdk/onboarding`** or a separate **`whatsapp-admin`** package if scope grows.

---

## Template management parity checklist

Implement in **`templates`** module:

| Feature | Existing code | Notes |
|---------|---------------|--------|
| Paginated fetch | `fetchAllMessageTemplates` | Preserve `paging.next` loop |
| Create | `createMessageTemplate` | Returns `id` |
| Delete by name + optional id | `deleteMessageTemplate` | Query `name`, `hsm_id` |

Consider expanding **`fields=`** Graph query strings (category, rejection reason) **behind optional params** — current code requests minimal fields (`id,name,language,status`).

---

## Marketing & utility compliance (outside HTTP)

Marketing messages may require **opt-in**, **conversation limits**, and **region-specific** timings. Recommend SDK document **`Limitations`** section + optional **`MessagingPolicy`** type for caller-provided assertions (never encode legal compliance as silent SDK defaults).
