import type { WhatsAppHttpClient } from "../client.ts";
import type { GraphListResponse, WhatsAppResult } from "../types/graph.ts";

// ─── Meta template shapes ────────────────────────────────────────────────

export type MetaTemplateStatus =
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "DELETED"
  | "PENDING"
  | "PENDING_REVIEW"
  | "FAILED"
  | "LIMIT_EXCEEDED"
  | "FLAGGED"
  | "UNKNOWN";

export type MetaTemplateCategory = "AUTHENTICATION" | "MARKETING" | "UTILITY";

export interface MetaTemplateRecord {
  id: string;
  name: string;
  language: string;
  status: MetaTemplateStatus;
  category?: MetaTemplateCategory;
  rejection_reason?: string;
  components?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CreateTemplatePayload {
  /** Snake-case, lowercase, no spaces — Meta requirement. */
  name: string;
  language: string;
  category: MetaTemplateCategory;
  components: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CreateTemplateResult {
  /** Meta-assigned template ID. */
  templateId: string;
  status?: MetaTemplateStatus;
  category?: MetaTemplateCategory;
}

export interface DeleteTemplateParams {
  name: string;
  /** Optional Meta template ID (`hsm_id`) for precision when multiple language variants share a name. */
  hsm_id?: string;
}

export interface ListTemplatesParams {
  /** Number of records per page. Max 200. @default 100 */
  limit?: number;
  /**
   * Comma-separated list of fields to include in each record.
   * @default "id,name,language,status"
   */
  fields?: string;
  /** Filter by template status. */
  status?: MetaTemplateStatus;
  /** Filter by category. */
  category?: MetaTemplateCategory;
}

// ─── Methods ─────────────────────────────────────────────────────────────

/**
 * Fetch one page of message templates for the configured WABA.
 * Returns the raw Meta list response including paging cursors.
 *
 * For full iteration over all pages use `listAllTemplates`.
 */
export function listTemplates(
  http: WhatsAppHttpClient,
  params: ListTemplatesParams = {},
): Promise<WhatsAppResult<GraphListResponse<MetaTemplateRecord>>> {
  const query: Record<string, string> = {
    limit: String(params.limit ?? 100),
    fields: params.fields ?? "id,name,language,status,category,rejection_reason",
  };
  if (params.status) query.status = params.status;
  if (params.category) query.category = params.category;

  return http.get<GraphListResponse<MetaTemplateRecord>>(
    `/${http.businessAccountId}/message_templates`,
    query,
  );
}

/**
 * Fetch **all** templates for the WABA by following `paging.next` until
 * exhausted. Aggregates results into a single array.
 *
 * Large WABAs may have hundreds of templates — `fields` can be narrowed to
 * avoid over-fetching:
 * ```ts
 * await listAllTemplates(http, { fields: "id,name,status" });
 * ```
 */
export async function listAllTemplates(
  http: WhatsAppHttpClient,
  params: ListTemplatesParams = {},
): Promise<WhatsAppResult<MetaTemplateRecord[]>> {
  const aggregated: MetaTemplateRecord[] = [];
  const query: Record<string, string> = {
    limit: String(params.limit ?? 100),
    fields: params.fields ?? "id,name,language,status,category,rejection_reason",
  };
  if (params.status) query.status = params.status;
  if (params.category) query.category = params.category;

  let url: string | null = http.url(
    `/${http.businessAccountId}/message_templates`,
    query,
  );

  const fetchFn = (http as unknown as { options?: { fetch?: typeof fetch } })
    ?.options?.fetch ?? globalThis.fetch;

  while (url) {
    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { Authorization: `Bearer ${http.credentials.accessToken}` },
      });
    } catch (err) {
      const { wrapNetworkError } = await import("../errors/graph_error.ts");
      return { ok: false, error: wrapNetworkError(err) };
    }

    const data = await response.json().catch(() => ({})) as GraphListResponse<MetaTemplateRecord>;

    if (!response.ok) {
      const { parseMetaError } = await import("../errors/graph_error.ts");
      return { ok: false, error: parseMetaError(response.status, data) };
    }

    aggregated.push(...(data.data ?? []));
    url = typeof data.paging?.next === "string" && data.paging.next.length > 0
      ? data.paging.next
      : null;
  }

  return { ok: true, data: aggregated };
}

/**
 * Submit a new template to Meta for review.
 *
 * After submission the template status will be `PENDING` until Meta approves
 * or rejects it (typically minutes to 24 h). Poll with `listTemplates` or
 * use webhooks for status callbacks.
 */
export async function createTemplate(
  http: WhatsAppHttpClient,
  payload: CreateTemplatePayload,
): Promise<WhatsAppResult<CreateTemplateResult>> {
  const result = await http.post<{
    id: string;
    status?: MetaTemplateStatus;
    category?: MetaTemplateCategory;
  }>(
    `/${http.businessAccountId}/message_templates`,
    payload as Record<string, unknown>,
  );

  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      templateId: result.data.id,
      status: result.data.status,
      category: result.data.category,
    },
  };
}

/**
 * Delete a template by name (and optional `hsm_id` for language-specific
 * deletion when multiple locales share a name).
 */
export async function deleteTemplate(
  http: WhatsAppHttpClient,
  params: DeleteTemplateParams,
): Promise<WhatsAppResult<boolean>> {
  const query: Record<string, string> = { name: params.name };
  if (params.hsm_id) query.hsm_id = params.hsm_id;

  const result = await http.delete<{ success: boolean }>(
    `/${http.businessAccountId}/message_templates`,
    query,
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}
