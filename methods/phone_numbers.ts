import type { WhatsAppHttpClient } from "../client.ts";
import type { GraphListResponse, WhatsAppResult } from "../types/graph.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export type WaQualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
export type WaCodeVerificationStatus =
  | "VERIFIED"
  | "NOT_VERIFIED"
  | "EXPIRED"
  | "PENDING";

export interface WaPhoneNumberRecord {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: WaQualityRating;
  code_verification_status?: WaCodeVerificationStatus;
  is_official_business_account?: boolean;
  [key: string]: unknown;
}

// ─── Methods ─────────────────────────────────────────────────────────────

const DEFAULT_PHONE_FIELDS =
  "id,verified_name,display_phone_number,quality_rating,code_verification_status,is_official_business_account";

/**
 * List all phone numbers registered under the configured WhatsApp Business Account.
 *
 * Each record includes the `id` (phone-number-id used for sending) along with
 * display number, quality rating, and verification status.
 */
export async function listPhoneNumbers(
  http: WhatsAppHttpClient,
  fields?: string,
): Promise<WhatsAppResult<WaPhoneNumberRecord[]>> {
  const result = await http.get<GraphListResponse<WaPhoneNumberRecord>>(
    `/${http.businessAccountId}/phone_numbers`,
    { fields: fields ?? DEFAULT_PHONE_FIELDS },
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.data ?? [] };
}
