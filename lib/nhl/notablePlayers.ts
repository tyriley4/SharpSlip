// A curated pool of well-known, high-usage current players. Early in a season the league-wide
// stat pool is too thin to compute a stable league-average hit rate (see lib/nhl/api.ts's
// getAllNHLSkaterStats/Goalies), so Betting Stats leaderboards and league-average comparisons are
// computed from this disclosed pool instead — the same scope tradeoff used for MLB/NBA.
export const NOTABLE_NHL_SKATERS = [
  'Connor McDavid', 'Nathan MacKinnon', 'Auston Matthews', 'Leon Draisaitl',
  'David Pastrnak', 'Nikita Kucherov', 'Artemi Panarin', 'Mitch Marner',
  'Jack Hughes', 'Kirill Kaprizov', 'Matthew Tkachuk', 'Mikko Rantanen',
  'Cale Makar', 'Quinn Hughes', 'Sidney Crosby', 'Alex Ovechkin',
  'William Nylander', 'Brayden Point', 'Jason Robertson', 'Elias Pettersson',
  'Tim Stutzle', 'Jack Eichel', 'Roman Josi', 'Adam Fox',
  'Zach Werenski', 'Filip Forsberg', 'Aleksander Barkov', 'Sam Reinhart',
  'Brady Tkachuk', 'Clayton Keller', 'Dylan Larkin', 'J.T. Miller',
  'Steven Stamkos', 'Sebastian Aho', 'Jesper Bratt', 'Robert Thomas',
  'Wyatt Johnston', 'Macklin Celebrini', 'Connor Bedard', 'Juraj Slafkovsky',
]

export const NOTABLE_NHL_GOALIES = [
  'Connor Hellebuyck', 'Igor Shesterkin', 'Jake Oettinger', 'Andrei Vasilevskiy',
  'Ilya Sorokin', 'Juuse Saros', 'Linus Ullmark', 'Thatcher Demko',
  'Jeremy Swayman', 'Stuart Skinner', 'Adin Hill', 'Joonas Korpisalo',
  'Sergei Bobrovsky', 'Logan Thompson', 'Jordan Binnington',
]
