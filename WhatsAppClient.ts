import { WhatsAppHttpClient } from "./client.ts";
import type { WhatsAppClientOptions, WhatsAppCredentials } from "./types/config.ts";
import type { WhatsAppResult } from "./types/graph.ts";
import type {
  MarkReadParams,
  SendContactsParams,
  SendInteractiveParams,
  SendLocationParams,
  SendMediaByIdParams,
  SendMediaByUrlParams,
  SendReactionParams,
  SendStickerParams,
  SendTemplateParams,
  SendTextParams,
  SendTypingParams,
  WaSendResult,
} from "./types/messages.ts";

import * as _messages from "./methods/messages.ts";
import * as _media from "./methods/media.ts";
import * as _templates from "./methods/templates.ts";
import * as _profile from "./methods/profile.ts";
import * as _phoneNumbers from "./methods/phone_numbers.ts";
import * as _blockUsers from "./methods/block_users.ts";

import type { MediaInfo, UploadMediaResult } from "./methods/media.ts";
import type {
  CreateTemplatePayload,
  CreateTemplateResult,
  DeleteTemplateParams,
  ListTemplatesParams,
  MetaTemplateRecord,
} from "./methods/templates.ts";
import type { BusinessProfile, UpdateBusinessProfileParams } from "./methods/profile.ts";
import type { WaPhoneNumberRecord } from "./methods/phone_numbers.ts";
import type { BlockUsersParams } from "./methods/block_users.ts";
import type { GraphListResponse } from "./types/graph.ts";

import {
  sendAuthOtpTemplate,
  sendMarketingTemplate,
  sendUtilityTemplate,
} from "./template/builders.ts";
import type {
  SendAuthOtpTemplateParams,
  SendMarketingTemplateParams,
  SendUtilityTemplateParams,
} from "./template/builders.ts";

// ─── Namespaced sub-clients ───────────────────────────────────────────────

/** Outbound message operations. */
class MessagesNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  sendText(params: SendTextParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendText(this.http, params);
  }
  sendMediaByUrl(params: SendMediaByUrlParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendMediaByUrl(this.http, params);
  }
  sendMediaById(params: SendMediaByIdParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendMediaById(this.http, params);
  }
  sendSticker(params: SendStickerParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendSticker(this.http, params);
  }
  sendReaction(params: SendReactionParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendReaction(this.http, params);
  }
  sendLocation(params: SendLocationParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendLocation(this.http, params);
  }
  sendContacts(params: SendContactsParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendContacts(this.http, params);
  }
  sendInteractive(params: SendInteractiveParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendInteractive(this.http, params);
  }
  sendTemplate(params: SendTemplateParams): Promise<WhatsAppResult<WaSendResult>> {
    return _messages.sendTemplate(this.http, params);
  }
  markAsRead(params: MarkReadParams): Promise<WhatsAppResult<boolean>> {
    return _messages.markAsRead(this.http, params);
  }
  sendTypingIndicator(params: SendTypingParams): Promise<WhatsAppResult<boolean>> {
    return _messages.sendTypingIndicator(this.http, params);
  }
}

/** Media upload, download, delete operations. */
class MediaNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  getInfo(mediaId: string): Promise<WhatsAppResult<MediaInfo>> {
    return _media.getMediaInfo(this.http, mediaId);
  }
  download(downloadUrl: string): Promise<WhatsAppResult<ArrayBuffer>> {
    return _media.downloadMedia(this.http, downloadUrl);
  }
  upload(
    fileData: ArrayBuffer,
    mimeType: string,
    fileName: string,
  ): Promise<WhatsAppResult<UploadMediaResult>> {
    return _media.uploadMedia(this.http, fileData, mimeType, fileName);
  }
  delete(mediaId: string): Promise<WhatsAppResult<boolean>> {
    return _media.deleteMedia(this.http, mediaId);
  }
}

/** Template CRUD + listing operations. */
class TemplatesNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  list(
    params?: ListTemplatesParams,
  ): Promise<WhatsAppResult<GraphListResponse<MetaTemplateRecord>>> {
    return _templates.listTemplates(this.http, params);
  }
  listAll(
    params?: ListTemplatesParams,
  ): Promise<WhatsAppResult<MetaTemplateRecord[]>> {
    return _templates.listAllTemplates(this.http, params);
  }
  create(payload: CreateTemplatePayload): Promise<WhatsAppResult<CreateTemplateResult>> {
    return _templates.createTemplate(this.http, payload);
  }
  delete(params: DeleteTemplateParams): Promise<WhatsAppResult<boolean>> {
    return _templates.deleteTemplate(this.http, params);
  }
}

/** Business profile read/update. */
class ProfileNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  get(): Promise<WhatsAppResult<BusinessProfile>> {
    return _profile.getBusinessProfile(this.http);
  }
  update(params: UpdateBusinessProfileParams): Promise<WhatsAppResult<boolean>> {
    return _profile.updateBusinessProfile(this.http, params);
  }
}

/** WABA phone-number listing. */
class PhoneNumbersNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  list(fields?: string): Promise<WhatsAppResult<WaPhoneNumberRecord[]>> {
    return _phoneNumbers.listPhoneNumbers(this.http, fields);
  }
}

/** Block / unblock users. */
class BlockUsersNamespace {
  constructor(private readonly http: WhatsAppHttpClient) {}

  block(params: BlockUsersParams): Promise<WhatsAppResult<boolean>> {
    return _blockUsers.blockUsers(this.http, params);
  }
  unblock(params: BlockUsersParams): Promise<WhatsAppResult<boolean>> {
    return _blockUsers.unblockUsers(this.http, params);
  }
}

// ─── Main client ──────────────────────────────────────────────────────────

/**
 * The primary entry point for the WhatsApp SDK.
 *
 * Instantiate once per credentials pair and reuse across your application.
 * For multi-number setups use `cloneWithPhoneNumberId` to get a lightweight
 * sibling client that shares the same WABA token.
 *
 * @example — Basic send
 * ```ts
 * import { WhatsAppClient } from "@WhatsApp/sdk";
 *
 * const wa = new WhatsAppClient({
 *   phoneNumberId:     "1234567890",
 *   businessAccountId: "0987654321",
 *   accessToken:       decryptedToken,
 * });
 *
 * const res = await wa.messages.sendText({ to: "201001234567", body: "Hi!" });
 * if (!res.ok) console.error(res.error.message, res.error.code);
 * ```
 *
 * @example — OTP
 * ```ts
 * const res = await wa.sendAuthOtp({
 *   to: "201001234567",
 *   templateName: "verify_otp",
 *   language: "en",
 *   otpCode: "847213",
 * });
 * ```
 *
 * @example — Multi-number
 * ```ts
 * const wa2 = wa.cloneWithPhoneNumberId("9876543210");
 * await wa2.messages.sendText({ to: "...", body: "From line 2" });
 * ```
 */
export class WhatsAppClient {
  private readonly http: WhatsAppHttpClient;

  /** Outbound message operations. */
  readonly messages: MessagesNamespace;
  /** Media upload / download / delete. */
  readonly media: MediaNamespace;
  /** Template CRUD and listing. */
  readonly templates: TemplatesNamespace;
  /** Business profile read / update. */
  readonly profile: ProfileNamespace;
  /** Phone numbers registered on the WABA. */
  readonly phoneNumbers: PhoneNumbersNamespace;
  /** Block / unblock users. */
  readonly users: BlockUsersNamespace;

  constructor(
    credentials: WhatsAppCredentials,
    options: WhatsAppClientOptions = {},
  ) {
    this.http = new WhatsAppHttpClient(credentials, options);
    this.messages = new MessagesNamespace(this.http);
    this.media = new MediaNamespace(this.http);
    this.templates = new TemplatesNamespace(this.http);
    this.profile = new ProfileNamespace(this.http);
    this.phoneNumbers = new PhoneNumbersNamespace(this.http);
    this.users = new BlockUsersNamespace(this.http);
  }

  // ─── Template intent shortcuts ──────────────────────────────────────────

  /**
   * Send a utility template message.
   * Shortcut for `messages.sendTemplate` with body-param assembly.
   */
  sendUtilityTemplate(
    params: SendUtilityTemplateParams,
  ): Promise<WhatsAppResult<WaSendResult>> {
    return sendUtilityTemplate(this.http, params);
  }

  /**
   * Send a marketing template message.
   * Caller is responsible for subscriber opt-in compliance.
   */
  sendMarketingTemplate(
    params: SendMarketingTemplateParams,
  ): Promise<WhatsAppResult<WaSendResult>> {
    return sendMarketingTemplate(this.http, params);
  }

  /**
   * Send an authentication (OTP) template message.
   * Assembles the required `BODY` + `BUTTONS` components automatically.
   */
  sendAuthOtp(
    params: SendAuthOtpTemplateParams,
  ): Promise<WhatsAppResult<WaSendResult>> {
    return sendAuthOtpTemplate(this.http, params);
  }

  // ─── Credential accessors ───────────────────────────────────────────────

  /** The configured phone number ID for this client instance. */
  get phoneNumberId(): string {
    return this.http.phoneNumberId;
  }

  /** The configured WhatsApp Business Account ID. */
  get businessAccountId(): string {
    return this.http.businessAccountId;
  }

  // ─── Clone helpers ──────────────────────────────────────────────────────

  /**
   * Create a sibling client with a different phone number ID.
   * Useful when multiple lines share the same WABA token.
   */
  cloneWithPhoneNumberId(phoneNumberId: string): WhatsAppClient {
    return new WhatsAppClient(
      { ...this.http.credentials, phoneNumberId },
      // Pass the internal http client's options through the factory.
    );
  }

  /**
   * Create a new client with entirely different credentials.
   */
  cloneWithCredentials(credentials: WhatsAppCredentials): WhatsAppClient {
    return new WhatsAppClient(credentials);
  }
}
