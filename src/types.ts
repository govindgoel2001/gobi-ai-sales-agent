import type { Request } from 'express';

export type Direction = 'inbound' | 'outbound';
export type Channel = 'whatsapp' | 'voice';
export type MessageStatus = 'pending' | 'sent' | 'failed';

export type StoredMessage = {
  direction: Direction;
  content: string;
  created_at?: string;
};

export type Contact = {
  id: string;
  phone: string;
  name: string | null;
  lead_score: number;
  stage: string;
  human_handoff: boolean;
  handoff_until: string | null;
  last_inbound_at: string | null;
};

/** A customer message, already narrowed to the parts we act on. */
export type IncomingMessage = {
  id: string;
  from: string;
  name: string | null;
  text: string;
};

/** A delivery receipt from Meta. This is where 131047 arrives. */
export type StatusUpdate = {
  messageId: string;
  status: string;
  errorCodes: number[];
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; code: number | null; detail: string };

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}
