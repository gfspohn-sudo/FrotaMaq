import { formatErrorMessage } from '@/lib/formatError'

/** Normaliza erros de repositório/casos de uso para a camada de apresentação. */
export function asServiceError(error: unknown): { message: string } | null {
  if (!error) return null
  return { message: formatErrorMessage(error) }
}
