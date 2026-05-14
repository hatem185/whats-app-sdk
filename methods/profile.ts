import type { WhatsAppHttpClient } from "../client.ts";
import type { WhatsAppResult } from "../types/graph.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export type WaVertical =
  | "UNDEFINED"
  | "OTHER"
  | "AUTO"
  | "BEAUTY"
  | "APPAREL"
  | "EDU"
  | "ENTERTAIN"
  | "EVENT_PLAN"
  | "FINANCE"
  | "GROCERY"
  | "GOVT"
  | "HOTEL"
  | "HEALTH"
  | "NONPROFIT"
  | "PROF_SERVICES"
  | "RETAIL"
  | "TRAVEL"
  | "RESTAURANT"
  | "NOT_A_BIZ";

export interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: WaVertical;
}

export interface UpdateBusinessProfileParams {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  /** Handle returned after uploading the profile picture via the Media API. */
  profile_picture_handle?: string;
  websites?: string[];
  vertical?: WaVertical;
}

// ─── Methods ─────────────────────────────────────────────────────────────

const PROFILE_FIELDS =
  "about,address,description,email,profile_picture_url,websites,vertical";

/**
 * Retrieve the WhatsApp Business Profile for the configured phone number.
 */
export async function getBusinessProfile(
  http: WhatsAppHttpClient,
): Promise<WhatsAppResult<BusinessProfile>> {
  const result = await http.get<{ data: BusinessProfile[] }>(
    `/${http.phoneNumberId}/whatsapp_business_profile`,
    { fields: PROFILE_FIELDS },
  );
  if (!result.ok) return result;
  const profile = result.data.data?.[0] ?? {};
  return { ok: true, data: profile };
}

/**
 * Update one or more fields of the WhatsApp Business Profile.
 * Only the supplied fields are changed; omitted fields are left untouched.
 */
export async function updateBusinessProfile(
  http: WhatsAppHttpClient,
  params: UpdateBusinessProfileParams,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.post<{ success: boolean }>(
    `/${http.phoneNumberId}/whatsapp_business_profile`,
    { messaging_product: "whatsapp", ...params },
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}
