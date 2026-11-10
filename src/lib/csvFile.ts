/** CSV compatível com Excel pt-BR (BOM UTF-8 + separador `;`). */

export function escapeCsvField(value: string | number): string {
  const str = String(value)
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(headers: readonly string[], rows: Array<Array<string | number>>): string {
  const headerLine = headers.map(escapeCsvField).join(';')
  const body = rows.map(row => row.map(escapeCsvField).join(';'))
  return `\uFEFF${[headerLine, ...body].join('\n')}`
}

export function toCsvWithMeta(
  meta: Array<readonly [string, string]>,
  headers: readonly string[],
  rows: Array<Array<string | number>>,
): string {
  const metaLines = meta.map(([key, value]) => [key, value].map(escapeCsvField).join(';'))
  const table = toCsv(headers, rows).replace(/^\uFEFF/, '')
  return `\uFEFF${metaLines.join('\n')}\n\n${table}`
}
