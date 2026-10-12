-- Run this in the Supabase Dashboard: SQL Editor > New Query > paste > Run
-- Creates the public.articles table ("SharpSlip Insights" on the home page + /articles pages)
-- and seeds 3 placeholder articles.

create table public.articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  sport text,
  category text,
  excerpt text,
  content text,
  author text default 'SharpSlip',
  published_at timestamptz default now(),
  is_published boolean default true,
  read_time_minutes integer default 3,
  created_at timestamptz default now()
);

alter table public.articles enable row level security;

create policy "Articles are publicly readable"
  on public.articles for select
  using (is_published = true);

create policy "Admins can manage articles"
  on public.articles for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );

create index articles_sport_idx on public.articles (sport);
create index articles_published_at_idx on public.articles (published_at desc);

insert into public.articles (title, slug, sport, category, excerpt, content, read_time_minutes) values
(
  'Understanding Pitcher Props: How to Find Value in K Markets',
  'understanding-pitcher-props-k-markets',
  'mlb',
  'Strategy',
  'Strikeout props are one of the most exploitable markets in baseball. Here is how SharpSlip identifies value using real Statcast data.',
  'Strikeout props move slower than game totals and moneylines, which means the market is often a step behind what the underlying skill indicators are actually saying. Two numbers do most of the work: K/9 (strikeouts per nine innings) tells you a pitcher''s baseline swing-and-miss rate over a full season, while CSW% (called strikes plus whiffs, as a share of total pitches) is the leading indicator — it reacts to a pitcher''s current stuff and command weeks before the box score catches up. When a pitcher''s CSW% is trending well above their season average but the sportsbook strikeout line hasn''t moved, that gap is where the value lives.

Matchup context matters just as much as the pitcher''s own form. A high-strikeout pitcher facing a lineup with an elevated team strikeout rate against their specific pitch mix (for example, a fastball-heavy starter against a lineup that chases elevated heat) is a much stronger target than the same pitcher against a contact-oriented lineup, even if the raw K/9 numbers look identical on paper. Park and umpire tendencies add a smaller but real edge too — some umpires call a noticeably larger strike zone, which padds called-strike counts independent of stuff.

The practical approach: start from the pitcher''s season K/9 and recent CSW% trend, cross-reference the opposing lineup''s team strikeout rate over the same recent window, and only then compare that composite read to the posted line. If both the pitcher''s recent form and the matchup point the same direction and the number hasn''t moved to reflect it, that''s a market lag worth betting into.

SharpSlip''s player pages are built around exactly this workflow — each pitcher''s page surfaces their recent strikeout game log alongside the specific threshold hit rates (K 4.5+ through 8.5+) computed from real game logs, so you can see at a glance whether the current line is behind the pitcher''s actual recent form before you bet it.',
  4
),
(
  'NFL Week ATS Trends: Why Home Underdogs Are Hitting',
  'nfl-week-ats-trends-home-underdogs',
  'nfl',
  'Trends',
  'Home underdogs have covered at a 58% rate through the first weeks of the season. SharpSlip breaks down why and which games to target.',
  'Home underdogs have quietly been one of the more profitable angles early this season, covering at a rate well above the breakeven line needed to beat the vig. Part of this is structural rather than random: public betting volume skews toward favorites and toward the road team in nationally televised matchups, which pushes spreads a point or more beyond what a purely model-driven line would set. That gap between the "public number" and the "true number" is exactly where home-dog value tends to concentrate.

Rest and travel are the other half of the story. Division road games and short-week travel spots quietly erode a favorite''s margin in ways a simple power rating doesn''t fully capture — a team flying cross-country on a short week is a measurably worse version of itself than its season-long numbers suggest, even when the talent gap on paper still favors them covering the number. Home underdogs in exactly this spot — a divisional favorite on the road on short rest — have been a particularly strong pocket of the overall trend.

None of this means every home underdog is a bet — the signal is strongest when it stacks with the situational factors above, not as a blanket fade of the market. The games worth targeting are the ones where the public is clearly leaning one way (a nationally-televised favorite, a popular road team) and the situational factors (rest, travel, divisional familiarity) point back toward the home dog.

SharpSlip''s NFL game breakdown pages surface the real season-to-date ATS and rest/situational splits for both teams in every matchup, so you can check whether a given home underdog actually fits this profile before laying action on it, rather than betting the trend blind.',
  3
),
(
  'NBA Opening Night Prop Angles: Points and PRA Markets',
  'nba-opening-night-prop-angles',
  'nba',
  'Props',
  'Opening night props carry unique value — books set lines without recent data. Here is how to exploit that edge.',
  'Opening night is the one night of the NBA season where sportsbooks are working with the least amount of current information. Preseason minutes are unreliable, rotations haven''t settled, and a full offseason of roster movement, coaching changes, and conditioning work separates the league you''re betting on from the one reflected in last year''s box scores. Lines are necessarily built on a mix of last season''s production and projection — which means they''re softer, and more exploitable, than at any other point in the year.

Points and PRA (points + rebounds + assists) are the two markets where this shows up most clearly, because both are heavily driven by projected role and usage rather than pure shooting variance. A player who earned a larger offensive role over the offseason — whether from a teammate''s departure, a new coaching system, or a strong training-camp buzz — often has a line still anchored to last year''s smaller role. The reverse is also true: a player who lost a path to touches (a new free-agent addition, a changed rotation) can be a fade candidate even if the number looks familiar.

The way to approach this profitably is to weight recent, concrete signals — preseason usage and minute trends, beat-reporter rotation reporting, depth-chart changes — more heavily than you would on a normal night in December, when a full season of current data has already corrected the lines. By a few weeks into the season, this specific edge mostly disappears as the market catches up.

SharpSlip''s NBA player pages show each player''s season and recent-game prop hit rates across Points, Rebounds, Assists, and PRA the moment real game data exists, so as soon as the first few games are in the books you can check whether opening night''s role assumptions were actually correct — and adjust before the next line-setting cycle does.',
  4
);
