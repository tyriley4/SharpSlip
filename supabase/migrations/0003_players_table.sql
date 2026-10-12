-- Run this in the Supabase Dashboard: SQL Editor > New Query > paste > Run
-- Note: requested as 0002_players_table.sql, renumbered to 0003 because
-- 0002_add_is_admin.sql already exists.

CREATE TABLE public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('mlb', 'nfl')),
  position TEXT NOT NULL,
  is_hot BOOLEAN DEFAULT FALSE,
  headline_stat TEXT,
  season_stats JSONB DEFAULT '{}',
  recent_form JSONB DEFAULT '[]',
  prop_records JSONB DEFAULT '[]',
  best_opponents JSONB DEFAULT '[]',
  worst_opponents JSONB DEFAULT '[]',
  best_venues JSONB DEFAULT '[]',
  worst_venues JSONB DEFAULT '[]',
  career_vs_opponents JSONB DEFAULT '{}',
  tonight_edge JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are publicly readable"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage players"
  ON public.players FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
