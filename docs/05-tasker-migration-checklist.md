# 05 — Tasker migration checklist

Phased rollout to replace **`WhatsAppService`** with **`WhatsAppClient`** from **`plugins/whatsapp-sdk/`**.

## Prerequisites

1. **`import_map.json`** entry (example): `"@WhatsApp/sdk": "./plugins/whatsapp-sdk/mod.ts"`.
2. Deno **`deno check`** on dependents (**run only with explicit approval** per project execution policy).

## Phase A — Shim compatibility

1. Implement SDK so static shapes match existing **`whatsappService.ts`** success/failure meanings (adapt return types gradually).
2. Replace **`helpers/whatsappService.ts`** body with **`export`** re-exports **or** keep file as thin **facade** calling **`WhatsAppClient`** — minimizes diff across **`WhatsAppService` consumers**.

## Phase B — Replace call sites systematically

| Area | Primary files | Notes |
|------|---------------|--------|
| Outbound CRM | **`helpers/crmService.ts`** | Large switch → delegate to **`client.messages`** |
| Controllers proxy | **`controllers/crmWhatsapp.ts`** | Token decrypt unchanged |
| Templates | **`controllers/crmTemplates.ts`**, **`helpers/crmTemplateMetaSync.ts`** | **`templates.*`**, paging fetch |
| Webhook verify/parse | **`controllers/crmWhatsappWebhook.ts`** | Import **`verify` + parse** helpers |
| Typing UX | **`controllers/crmConversations.ts`** | Unchanged semantics |

## Phase C — Behavioral improvements (optional backlog)

1. Wire **`freeTextFallbackTemplate*`** policies into **`sendOutboundMessage`** (**stored in model but unused in send path today**) — compose **`sendTemplate`** with **`{{1}}`** body substitution per model comments in **`crmWhatsappConfig`**.
2. Centralize **`normalizeWhatsAppRecipient`** before send.
3. Replace string-only **`error`** with structured **`WhatsAppGraphError`** in **`CrmMessage.errorDetails`** (JSON-encoded) behind feature flag.

## Phase D — Remove dead shim

Drop duplicate HTTP code path once callers import SDK directly and behavior is validated in production-like environments.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Graph version drift (**v21.0**) | **`graphApiVersion`** option defaults to current prod value |
| Auth template send breakage | Dedicated builder + parity against Postman / official docs |
| Multi-line config mismatch | Preserve **`conversation.whatsappPhoneNumberId`** resolution order in **`crmService`** |
