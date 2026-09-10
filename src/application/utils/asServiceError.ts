/** Normaliza erros de repositório/casos de uso para a camada de apresentação. */
export function asServiceError(error: unknown): { message: string } | null {
  if (!error) return null
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return { message: String((error as { message: unknown }).message) }
  }
  return { message: String(error) }
}
