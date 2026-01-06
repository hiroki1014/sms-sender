export function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    return variables[trimmedKey] !== undefined ? variables[trimmedKey] : match
  })
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || []
  return Array.from(new Set(matches.map(m => m.slice(2, -2).trim())))
}
