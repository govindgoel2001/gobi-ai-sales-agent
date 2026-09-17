import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const dbCode = readFileSync('src/db/supabase.ts', 'utf8');

describe('schema', () => {
  it('has the dedup table the webhook depends on', () => {
    expect(schema).toContain('create table if not exists public.processed_messages');
    expect(schema).toContain('message_id text primary key');
  });

  it('tracks when someone last wrote in, for the 24 hour window', () => {
    expect(schema).toContain('last_inbound_at');
  });

  it('records whether an outbound message actually went out', () => {
    expect(schema).toMatch(/status text not null.*check \(status in \('pending', 'sent', 'failed'\)\)/s);
  });

  it('allows voice as a channel so calls can be stored', () => {
    expect(schema).toContain("check (channel in ('whatsapp', 'voice'))");
  });

  it('leaves row level security on for every table', () => {
    for (const table of ['contacts', 'messages', 'processed_messages']) {
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }
  });
});

describe('database code matches the schema', () => {
  it('reads every contact column the handler depends on', () => {
    const selects = dbCode.match(/\.select\(CONTACT_COLUMNS\)/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);

    const declared = dbCode.match(/const CONTACT_COLUMNS =\s*'([^']*)'/);
    expect(declared, 'CONTACT_COLUMNS is not declared as a single string').not.toBeNull();

    const columns = declared![1].split(',').map((c) => c.trim());
    for (const needed of ['last_inbound_at', 'handoff_until', 'lead_score', 'human_handoff']) {
      expect(columns, `${needed} is never selected, so the handler reads undefined`).toContain(needed);
      expect(schema, `${needed} is selected but the schema never creates it`).toContain(needed);
    }
  });

  it('records when a claim was handled, so a crash does not swallow the message', () => {
    expect(schema).toContain('handled_at');
    expect(schema).toContain('claimed_at');
    expect(dbCode).toContain('export async function markHandled');
    expect(dbCode).toContain('export async function releaseClaim');
  });

  it('references only tables that exist', () => {
    const tables = new Set((dbCode.match(/\.from\('(\w+)'\)/g) ?? []).map((m) => m.slice(7, -2)));
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(schema, `code reads ${table} but the schema never creates it`)
        .toContain(`create table if not exists public.${table}`);
    }
  });

  it('claims a message before anything expensive happens', () => {
    expect(dbCode).toContain('ignoreDuplicates: true');
  });

  it('checks the error on the status counts rather than reporting zeros', () => {
    // supabase-js reports failure in the result rather than by throwing, so
    // reading .count straight off an unreachable database gives three zeros and
    // a green dot. That is the one thing the status page must never show.
    expect(dbCode).toMatch(/const failure = contacts\.error \?\? messages\.error \?\? hot\.error/);
    expect(dbCode).toContain('if (failure) throw failure');
  });
});
