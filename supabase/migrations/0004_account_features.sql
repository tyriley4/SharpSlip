-- Run this in the Supabase Dashboard: SQL Editor > New Query > paste > Run
-- Adds the bet tracker's `bets` table, plus `favorites` and `settings` JSONB columns on
-- public.users for the Account tab's Favorites and Settings features.

create table public.bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  sport text not null,
  bet_type text not null,
  description text not null,
  odds integer not null,
  stake decimal(10,2) not null,
  game_date date,
  result text default 'pending'
    check (result in ('pending','win','loss','push')),
  profit decimal(10,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bets enable row level security;

create policy "Users can manage own bets"
  on public.bets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index bets_user_id_idx on public.bets (user_id);

-- Reuses the trigger function already defined in 0003_players_table.sql.
drop trigger if exists set_bets_updated_at on public.bets;
create trigger set_bets_updated_at
  before update on public.bets
  for each row execute function update_updated_at_column();

-- Favorites (teams/players) and app settings, stored as JSONB on the user's own profile row.
-- Both are covered by the existing "Users can update own profile" policy from 0001.
alter table public.users add column if not exists favorites jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists settings jsonb not null default '{}'::jsonb;
