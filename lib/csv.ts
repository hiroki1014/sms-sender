export interface CsvRow {
  [key: string]: string
}

export interface ParsedCsv {
  headers: string[]
  rows: CsvRow[]
}

export function parseCsv(csvText: string): ParsedCsv {
  const trimmed = csvText.trim()
  if (!trimmed) {
    return { headers: [], rows: [] }
  }

  const lines = trimmed.split('\n')

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
  // 日本語を含む変数名に対応: {{変数名}}
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    return row[trimmedKey] !== undefined ? row[trimmedKey] : match
  })
}

export function extractVariables(template: string): string[] {
  // 日本語を含む変数名に対応
  const matches = template.match(/\{\{([^}]+)\}\}/g) || []
  return Array.from(new Set(matches.map(m => m.slice(2, -2).trim())))
}
