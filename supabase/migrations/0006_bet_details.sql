-- Run this in the Supabase Dashboard: SQL Editor > New Query > paste > Run
-- Structured bet tracking: stores each bet's legs (game, market, line, odds, per-leg result),
-- teaser points and the unit/stake choice as JSON next to the human-readable `description`.
-- The app keeps working without this column (bets save with a readable description only), but
-- parlay legs can only be expanded in the history once it exists.

alter table public.bets add column if not exists details jsonb;
