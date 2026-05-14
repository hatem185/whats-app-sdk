# 04 — Errors, retries, idempotency, observability

## Meta Graph error envelope (baseline)

Normalize every non-OK response into **`WhatsAppGraphError`**:

- `status: number` (HTTP status)
- `message: string`
- `code?: number` — Graph **`error.code`**
- `errorSubcode?: number`
- `type?: string` — OAuth/Meta **`type`** string
- `fbtrace_id?: string` — **`error.fbtrace_id`**
- `raw?: Record<string, unknown>` — verbatim JSON slice for forensic logs (**strip tokens** upstream)

Today's **`helpers/whatsappService.ts`** **`sendMessage`** only surfaces **`error.message`** string → **lossy** for policy handling.

### Known WhatsApp-business codes (caller-facing)

Webhook + CRM already treat **`131047`** (re-engagement / outside customer care session) specially via **`whatsappErrorCode`**. Maintain a **`KNOWN_CODES`** map inside SDK (**documentation table + typed enum**) referencing [Cloud API troubleshooting](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes).

---

## Retry strategy

Apply **retry only when safe**:

| Scenario | Retry? |
|----------|--------|
| Network timeout / **`ECONNRESET`** | Yes — capped exponential backoff + jitter |
| **429** + `Retry-After` | Respect header if present |
| **5xx** from Graph | Limited retries (**idempotency caveat** below) |
| **4xx** with validation / policy (**400**) | Generally **no** |
| **`131047`** (session window) | **No** retry with same plaintext body — caller must escalate to template |

Configurable **`RetryPolicy`** on **`WhatsAppClient`**:

```ts
type RetryPolicy = {
  maxAttempts: number;
  baseMs: number;
  maxMs: number;
  jitterRatio: number;
  retryPredicate: (error: WhatsAppGraphError | Error) => boolean;
};
```

Default predicate allows **transport errors** + **408/429** + **502/503/504** (+ optional quirks if observed).

---

## Idempotency

Meta Graph **does not** document a mandatory idempotency header for **`/messages`**; duplicate POSTs risk **duplicate customer messages**.

Strategies (**choose at host layer**):

1. **Outbound gate** — before calling SDK, CRM inserts **`deliveryKey = hash(templateName|normalizedBody|conversationId)`** row with TTL; deny duplicate dispatch.
2. **Client-supplied **`idempotencyKey`** mapped to **`messaging`** queue job id (**`crmQueueWorker`** patterns) rather than blindly re-POST Graph.
3. Experimental headers **without** widespread Meta endorsement → **don't rely** without documented support.

Expose SDK hook:

```ts
type RequestHook = (
  req: { method: string; url: string; body: unknown },
  next: () => Promise<Response>,
) => Promise<Response>;
```

Host implements **sticky idempotency** / logging.

---

## Logging / PII hygiene

Never log **`access_token`**.

Log:

- **`phone_number_id`**, **`waba_id`** (non-secret but tenant-scoped).
- **`to`** — pseudonymized by default (**last 4**) unless a **caller-supplied debug flag** enables full dumps.
- **`fbtrace_id`** on failures.
- **Template name** (**business-sensitive**) — truncate in shared logs.

---

## Webhook reliability notes

 **`crmWhatsappWebhook`** uses **always 200 OK** for Meta (**good**) while processing async.

SDK docs should recommend duplicate detection using **`messages[].id`** (`wamid...`) keyed in DB (**already implied** by `isNew` gate in webhook controller).
