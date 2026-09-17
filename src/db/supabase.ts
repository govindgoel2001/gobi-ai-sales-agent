import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { Channel, Contact, Direction, MessageStatus, StoredMessage } from '../types.js';

const db = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const CONTACT_COLUMNS =
  'id, phone, name, lead_score, stage, human_handoff, handoff_until, last_inbound_at';

/** How long a claim can sit unhandled before another delivery may take it over. */
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Returns true when this delivery should be processed.
 *
 * ignoreDuplicates turns the insert into ON CONFLICT DO NOTHING, so a
 * re-delivery returns no rows instead of raising. Called before any model work,
 * which is the point: the expensive part never runs twice.
 *
 * The second half is what stops a claim becoming a black hole. If the process
 * dies between claiming and replying, the id is already recorded, so Meta's
 * retry would be deduped away and that customer would never be answered at all.
 * An unhandled claim older than STALE_CLAIM_MS is therefore taken over rather
 * than treated as done.
 */
export async function claimMessage(messageId: string): Promise<boolean> {
  const { data, error } = await db
    .from('processed_messages')
    .upsert({ message_id: messageId, claimed_at: new Date().toISOString() },
            { onConflict: 'message_id', ignoreDuplicates: true })
    .select('message_id');

  if (error) throw error;
  if ((data ?? []).length > 0) return true;

  const { data: existing, error: readError } = await db
    .from('processed_messages')
    .select('message_id, claimed_at, handled_at')
    .eq('message_id', messageId)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing || existing.handled_at) return false;

  const claimedAt = new Date(existing.claimed_at).getTime();
  if (Number.isNaN(claimedAt) || Date.now() - claimedAt < STALE_CLAIM_MS) return false;

  // Only take it over if nobody else has in the meantime. The claimed_at match
  // makes this a compare and swap rather than a blind overwrite, so two
  // simultaneous retries cannot both decide they won.
  const { data: taken, error: takeError } = await db
    .from('processed_messages')
    .update({ claimed_at: new Date().toISOString() })
    .eq('message_id', messageId)
    .eq('claimed_at', existing.claimed_at)
    .is('handled_at', null)
    .select('message_id');

  if (takeError) throw takeError;
  return (taken ?? []).length > 0;
}

/** Marks a claim finished, so it is never reclaimed. */
export async function markHandled(messageId: string) {
  const { error } = await db
    .from('processed_messages')
    .update({ handled_at: new Date().toISOString() })
    .eq('message_id', messageId);
  if (error) throw error;
}

/**
 * Drops a claim so the next delivery can retry immediately.
 *
 * Used when handling threw. Without it the customer waits out the full stale
 * window for a failure we already know about.
 */
export async function releaseClaim(messageId: string) {
  const { error } = await db
    .from('processed_messages')
    .delete()
    .eq('message_id', messageId)
    .is('handled_at', null);
  if (error) throw error;
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

export async function updateLead(
  contactId: string,
  leadScore: number,
  stage: string,
  humanHandoff = false,
  handoffUntil: string | null = null
) {
  const { error } = await db
    .from('contacts')
    .update({
      lead_score: leadScore,
      stage,
      human_handoff: humanHandoff,
      handoff_until: handoffUntil,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);
  if (error) throw error;
}

/**
 * Three counts for the status page. Head-only selects, so no rows cross the wire.
 *
 * The error checks matter more than they look. supabase-js reports failure in
 * the result rather than by throwing, so reading `.count ?? 0` straight off an
 * unreachable database yields three zeros and a green dot, which is the one
 * thing this page must never do.
 */
export async function countsForStatus() {
  const [contacts, messages, hot] = await Promise.all([
    db.from('contacts').select('id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('stage', 'hot')
  ]);

  const failure = contacts.error ?? messages.error ?? hot.error;
  if (failure) throw failure;

  return {
    contacts: contacts.count ?? 0,
    messages: messages.count ?? 0,
    hot: hot.count ?? 0
  };
}
