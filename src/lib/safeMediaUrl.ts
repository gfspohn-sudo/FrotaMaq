/** Aceita apenas URLs https absolutas para uso em <img src>. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}
