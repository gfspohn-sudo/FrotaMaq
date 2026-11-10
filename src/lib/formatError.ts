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

const FIELD_HINTS: Array<{ match: RegExp; message: string }> = [
  { match: /veiculo_id|veículo|veiculo/i, message: 'Veículo' },
  { match: /data_viagem|data da viagem/i, message: 'Data da viagem' },
  { match: /destino/i, message: 'Destino' },
  { match: /km_ida_volta|quilometragem/i, message: 'Quilometragem ida e volta' },
  { match: /empresa_id|empresa/i, message: 'Empresa' },
  { match: /motorista_id/i, message: 'Motorista' },
]

export function describeReservaSubmitError(error: unknown): string {
  const raw = formatErrorMessage(error)
  const lower = raw.toLowerCase()

  if (lower.includes('row-level security') || lower.includes('42501') || lower.includes('permission denied')) {
    return 'Permissão insuficiente para criar a viagem (RLS). Verifique se o veículo pertence à sua empresa e se você está autenticado.'
  }

  if (lower.includes('null value') || lower.includes('not-null') || lower.includes('violates check')) {
    const field = FIELD_HINTS.find(item => item.match.test(raw))?.message
    return field
      ? `O campo "${field}" foi rejeitado pelo banco (valor nulo ou inválido).`
      : `O banco rejeitou um campo obrigatório: ${raw}`
  }

  return raw
}
