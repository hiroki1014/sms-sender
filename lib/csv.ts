export interface CsvRow {
  [key: string]: string
}

export interface ParsedCsv {
  headers: string[]
  rows: CsvRow[]
}

export function parseCsv(csvText: string): ParsedCsv {
  const lines = csvText.trim().split('\n')

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // ヘッダー行をパース
  const headers = parseCsvLine(lines[0])

  // データ行をパース
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length === 0 || values.every(v => v === '')) continue

    const row: CsvRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

export function replaceVariables(template: string, row: CsvRow): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return row[key] !== undefined ? row[key] : match
  })
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
}
