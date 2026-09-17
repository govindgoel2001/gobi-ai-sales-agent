create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  stage text not null default 'new',
  human_handoff boolean not null default false,
  -- When the agent should start answering this contact again. A handoff that
  -- never expires is a contact the agent is permanently dead for, which is
  -- worse than one a human forgot to pick up.
  handoff_until timestamptz,
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
--
-- handled_at is what stops a claim becoming a black hole. Claiming and handling
-- are not the same event, and a process that dies between them would otherwise
-- leave an id claimed forever, so Meta's retry gets deduped away and that
-- customer is never answered at all. A claim with no handled_at is reclaimable
-- once it is stale.
create table if not exists public.processed_messages (
  message_id text primary key,
  claimed_at timestamptz not null default now(),
  handled_at timestamptz,
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
