import type { WhatsAppHttpClient } from "../client.ts";
import type { WhatsAppResult } from "../types/graph.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export interface BlockUsersParams {
  /**
   * Phone numbers to block (E.164 digits without leading +).
   * At least one number required.
   */
  userPhones: string[];
}

// ─── Methods ─────────────────────────────────────────────────────────────

/**
 * Block one or more users from sending messages to this phone number.
 * Blocked users will not receive delivery confirmation that they are blocked.
 */
export async function blockUsers(
  http: WhatsAppHttpClient,
  params: BlockUsersParams,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.post<{ success: boolean }>(
    `/${http.phoneNumberId}/block_users`,
    {
      messaging_product: "whatsapp",
      block_users: params.userPhones.map((user) => ({ user })),
    },
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}

/**
 * Unblock previously blocked users, restoring their ability to message
 * this phone number.
 */
export async function unblockUsers(
  http: WhatsAppHttpClient,
  params: BlockUsersParams,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.delete<{ success: boolean }>(
    `/${http.phoneNumberId}/block_users`,
    undefined,
    {
      messaging_product: "whatsapp",
      block_users: params.userPhones.map((user) => ({ user })),
    },
  );
  if (!result.ok) return result;
  return { ok: true, data: true };
}
