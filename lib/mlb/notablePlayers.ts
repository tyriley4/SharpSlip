// A curated pool of well-known current players, reused across Movers and the
// Quality-Starts leaderboard (the public MLB Stats API has no endpoint for
// league-wide trailing-window or quality-start leaders, so those features are
// computed from this pool's game logs instead of the full ~1500-player league).

export const NOTABLE_HITTERS = [
  'Masataka Yoshida', 'Rafael Devers', 'Triston Casas', "Tyler O'Neill",
  'Aaron Judge', 'Juan Soto', 'Giancarlo Stanton', 'Anthony Rizzo',
  'Mookie Betts', 'Freddie Freeman', 'Shohei Ohtani', 'Will Smith',
  'Matt Chapman', 'Jung Hoo Lee', 'Wilmer Flores', 'Patrick Bailey',
  'Yordan Alvarez', 'Jose Altuve', 'Alex Bregman', 'Kyle Tucker',
  'Ronald Acuña Jr.', 'Matt Olson', 'Austin Riley', 'Ozzie Albies',
  'Bo Bichette', 'Vladimir Guerrero Jr.', 'George Springer', 'Daulton Varsho',
  'Gunnar Henderson', 'Adley Rutschman', 'Anthony Santander', 'Ryan Mountcastle',
  'Corey Seager', 'Marcus Semien', 'Adolis García', 'Nathaniel Lowe',
  'Yandy Díaz', 'Randy Arozarena', 'Isaac Paredes', 'Brandon Lowe',
]

export const NOTABLE_PITCHERS = [
  'Brayan Bello', 'Gerrit Cole', 'Tyler Glasnow', 'Logan Webb',
  'Framber Valdez', 'Spencer Strider', 'Kevin Gausman', 'John Means',
  'Dane Dunning', 'Shane McClanahan', 'Zack Wheeler', 'Tarik Skubal',
  'Chris Sale', 'Paul Skenes', 'Corbin Burnes', 'Logan Gilbert',
  'Hunter Greene', 'Ranger Suárez', 'Sonny Gray', 'Dylan Cease',
]
