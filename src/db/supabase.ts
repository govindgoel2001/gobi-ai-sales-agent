import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { Channel, Contact, Direction, MessageStatus, StoredMessage } from '../types.js';

const db = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const CONTACT_COLUMNS = 'id, phone, name, lead_score, stage, human_handoff, last_inbound_at';

/**
 * Returns true the first time an id is seen and false for every retry.
 *
 * ignoreDuplicates turns the insert into ON CONFLICT DO NOTHING, so a
 * re-delivery returns no rows instead of raising. Called before any model work,
 * which is the point: the expensive part never runs twice.
 */
export async function claimMessage(messageId: string): Promise<boolean> {
  const { data, error } = await db
    .from('processed_messages')
    .upsert({ message_id: messageId }, { onConflict: 'message_id', ignoreDuplicates: true })
    .select('message_id');

  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function getOrCreateContact(phone: string, name?: string | null): Promise<Contact> {
  const { data: existing, error: findError } = await db
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .eq('phone', phone)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (name && name !== existing.name) {
      await db.from('contacts').update({ name }).eq('id', existing.id);
      existing.name = name;
    }
    return existing as Contact;
  }

  const { data, error } = await db
    .from('contacts')
    .insert({ phone, name: name ?? null })
    .select(CONTACT_COLUMNS)
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function saveMessage(
  contactId: string,
  direction: Direction,
  content: string,
  channel: Channel = 'whatsapp',
  status: MessageStatus = 'sent'
) {
  const { error } = await db.from('messages').insert({
    contact_id: contactId,
    direction,
    content,
    channel,
    status
  });
  if (error) throw error;
}

export async function getHistory(contactId: string, limit = 16): Promise<StoredMessage[]> {
  const { data, error } = await db
    .from('messages')
    .select('direction, content, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as StoredMessage[]).reverse();
}

/** Stamps the moment the 24 hour reply window reopened. */
export async function touchInbound(contactId: string) {
  const now = new Date().toISOString();
  const { error } = await db
    .from('contacts')
    .update({ last_inbound_at: now, updated_at: now })
    .eq('id', contactId);
  if (error) throw error;
}

export async function updateLead(contactId: string, leadScore: number, stage: string, humanHandoff = false) {
  const { error } = await db
    .from('contacts')
    .update({
      lead_score: leadScore,
      stage,
      human_handoff: humanHandoff,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);
  if (error) throw error;
}

/** Three counts for the status page. Head-only selects, so no rows cross the wire. */
export async function countsForStatus() {
  const [contacts, messages, hot] = await Promise.all([
    db.from('contacts').select('id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('stage', 'hot')
  ]);

  return {
    contacts: contacts.count ?? 0,
    messages: messages.count ?? 0,
    hot: hot.count ?? 0
  };
}
