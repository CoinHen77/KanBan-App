-- ================================================================
-- Kanban App — Supabase Schema
-- Run in Supabase SQL Editor → New Query → Run
-- ================================================================

create extension if not exists "pgcrypto";

-- ── Tables ────────────────────────────────────────────────────────

create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#5a554c',
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists templates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  board_id          uuid not null references boards(id) on delete cascade,
  title             text not null default '',
  notes             text,
  recurrence_rule   jsonb,
  subtasks_template jsonb not null default '[]',
  updated_at        timestamptz not null default now()
);

-- column stores only 'todo' | 'progress' | 'done' — never 'today' (derived in app)
create table if not exists cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  board_id     uuid not null references boards(id) on delete cascade,
  template_id  uuid references templates(id) on delete set null,
  title        text not null default '',
  notes        text,
  column       text not null default 'todo'
               check (column in ('todo', 'progress', 'done')),
  due_date     date,
  subtasks     jsonb not null default '[]',
  waiting_on   jsonb,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  device_id    uuid
);

create table if not exists devices (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text,
  last_seen timestamptz not null default now()
);

-- Short-lived pairing codes (5-min TTL enforced in app logic)
create table if not exists pairing_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

-- ── Row Level Security ────────────────────────────────────────────

alter table boards        enable row level security;
alter table templates     enable row level security;
alter table cards         enable row level security;
alter table devices       enable row level security;
alter table pairing_codes enable row level security;

-- boards: full access to owner only
create policy "boards_owner" on boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- templates: full access to owner only
create policy "templates_owner" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cards: full access to owner only
create policy "cards_owner" on cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- devices: full access to owner only
create policy "devices_owner" on devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- pairing_codes:
--   insert: only your own codes
--   select: any authenticated user (Device B must read Device A's code)
--   delete: owner only (cleanup after redemption)
create policy "pairing_codes_insert" on pairing_codes
  for insert with check (auth.uid() = user_id);
create policy "pairing_codes_read" on pairing_codes
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "pairing_codes_delete" on pairing_codes
  for delete using (auth.uid() = user_id);

-- ── Realtime ──────────────────────────────────────────────────────
-- Enable in Supabase Dashboard → Database → Replication
-- or uncomment if your project supports direct publication commands:
-- alter publication supabase_realtime add table boards;
-- alter publication supabase_realtime add table cards;
-- alter publication supabase_realtime add table templates;

-- ── After running ─────────────────────────────────────────────────
-- 1. Authentication → Providers → Email: disable "Confirm email"
-- 2. Authentication → Settings: enable "Allow anonymous sign-ins"
-- 3. Dashboard → Database → Replication: add boards, cards, templates
-- ================================================================
