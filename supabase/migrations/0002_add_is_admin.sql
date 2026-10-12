-- Run this in the Supabase Dashboard: SQL Editor > New Query > paste > Run

alter table public.users
  add column is_admin boolean not null default false;
