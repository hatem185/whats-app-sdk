import type { WhatsAppHttpClient } from "../client.ts";
import type { WhatsAppResult } from "../types/graph.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export interface MediaInfo {
  /** Meta media ID — use with `sendMediaById`. */
  id: string;
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  messaging_product: "whatsapp";
}

export interface UploadMediaResult {
  /** Reusable media ID valid for 30 days. */
  mediaId: string;
}

// ─── Methods ──────────────────────────────────────────────────────────────

/**
 * Retrieve the temporary download URL and metadata for a media object by ID.
 * The returned URL is only valid for a short window (~5 minutes) — download
 * the binary promptly with `downloadMedia`.
 */
export function getMediaInfo(
  http: WhatsAppHttpClient,
  mediaId: string,
): Promise<WhatsAppResult<MediaInfo>> {
  return http.get<MediaInfo>(`/${mediaId}`);
}

/**
 * Download the binary content of a media file from the URL returned by
 * `getMediaInfo`. Returns raw bytes as an `ArrayBuffer`.
 */
export function downloadMedia(
  http: WhatsAppHttpClient,
  downloadUrl: string,
): Promise<WhatsAppResult<ArrayBuffer>> {
  return http.requestBinary(downloadUrl);
}

/**
 * Upload a local file to the WhatsApp media store and obtain a reusable
 * media ID. Supported types and size limits follow Meta's current policy
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media).
 *
 * @param fileData - Raw file bytes.
 * @param mimeType - MIME type, e.g. `"image/jpeg"`.
 * @param fileName - Original file name (used by WhatsApp for documents).
 */
export async function uploadMedia(
  http: WhatsAppHttpClient,
  fileData: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<WhatsAppResult<UploadMediaResult>> {
  const form = new FormData();
  form.append("file", new Blob([fileData], { type: mimeType }), fileName);
  form.append("messaging_product", "whatsapp");

  const result = await http.requestForm<{ id: string }>(
    `/${http.phoneNumberId}/media`,
    form,
  );
  if (!result.ok) return result;
  return { ok: true, data: { mediaId: result.data.id } };
}

/**
 * Delete a previously uploaded media object.
 */
export async function deleteMedia(
  http: WhatsAppHttpClient,
  mediaId: string,
): Promise<WhatsAppResult<boolean>> {
  const result = await http.delete<{ deleted: boolean }>(`/${mediaId}`);
  if (!result.ok) return result;
  return { ok: true, data: result.data.deleted ?? true };
}
