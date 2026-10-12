// A curated pool of well-known, high-usage current players. The free NBA Stats API has no
// endpoint for league-wide trailing-window prop hit rates, and pulling full game logs for the
// entire ~450-player league (one request per player, each subject to the API's aggressive
// rate limiting) isn't practical — so Betting Stats leaderboards are computed from this pool's
// game logs instead, the same disclosed scope tradeoff used for MLB's Leaders/Movers.
export const NOTABLE_NBA_PLAYERS = [
  'Nikola Jokic', 'Luka Doncic', 'Giannis Antetokounmpo', 'Shai Gilgeous-Alexander',
  'Jayson Tatum', 'Joel Embiid', 'Devin Booker', 'Anthony Edwards',
  'Tyrese Haliburton', 'Donovan Mitchell', 'Damian Lillard', 'Stephen Curry',
  'LeBron James', 'Anthony Davis', 'Kevin Durant', 'Jalen Brunson',
  'De\'Aaron Fox', 'Domantas Sabonis', 'Trae Young', 'Paolo Banchero',
  'Cade Cunningham', 'Victor Wembanyama', 'Ja Morant', 'Zion Williamson',
  'Kawhi Leonard', 'Paul George', 'Jimmy Butler', 'Bam Adebayo',
  'Jaylen Brown', 'Kristaps Porzingis', 'Karl-Anthony Towns', 'Pascal Siakam',
  'Rudy Gobert', 'James Harden', 'Kyrie Irving', 'Alperen Sengun',
  'Evan Mobley', 'Darius Garland', 'Scottie Barnes', 'RJ Barrett',
  'Franz Wagner', 'Desmond Bane', 'Jaren Jackson Jr.', 'Lauri Markkanen',
  'Jalen Williams', 'Chet Holmgren', 'Coby White', 'Tyler Herro',
  'Brandon Ingram', 'Michael Porter Jr.',
]
