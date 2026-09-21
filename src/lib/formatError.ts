/** Extrai mensagem legível de Error, PostgrestError ou objetos genéricos. */
export function formatErrorMessage(error: unknown): string {
  if (!error) return 'Erro desconhecido'
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>
    const parts: string[] = []

    if (typeof record.message === 'string') parts.push(record.message)
    if (typeof record.details === 'string') parts.push(record.details)
    if (typeof record.hint === 'string') parts.push(record.hint)
    if (typeof record.code === 'string') parts.push(`(${record.code})`)

    if (parts.length > 0) return parts.join(' — ')

    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(formatErrorMessage(error))
}
