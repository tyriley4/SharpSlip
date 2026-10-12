const DIACRITIC_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(DIACRITIC_MARKS, '')
    .replace(/[.']/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
