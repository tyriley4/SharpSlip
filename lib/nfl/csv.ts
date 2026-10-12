/** Minimal RFC4180 CSV parser — handles quoted fields, embedded commas, and escaped quotes ("" inside a quoted field). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (c === '\r') {
      // skip, \n handles the row break
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []
  const header = rows[0]
  return rows.slice(1).filter((r) => r.length === header.length || (r.length === 1 && r[0] === '')).map((r) => {
    const obj: Record<string, string> = {}
    header.forEach((h, i) => {
      obj[h] = r[i] ?? ''
    })
    return obj
  }).filter((r) => Object.values(r).some((v) => v !== ''))
}
