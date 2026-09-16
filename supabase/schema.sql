create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  stage text not null default 'new',
  human_handoff boolean not null default false,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'voice')),
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'sent' check (status in ('pending', 'sent', 'failed')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Meta retries a webhook on any hiccup. Without this table a retry produces a
-- second model call, a second reply to the customer, and a second stored row.
-- The primary key does the work: the insert either takes or it does not.
create table if not exists public.processed_messages (
  message_id text primary key,
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_created_idx
  on public.messages(contact_id, created_at desc);

alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.processed_messages enable row level security;

-- The backend connects with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- RLS is on anyway so that a browser client added later starts with no access
-- rather than full access. Add policies when you build one.
