import {
  supabase,
  supabaseConfig,
  getSupabaseConfigError,
  formatSupabaseError,
  formatDetailedError,
  isFailedToFetchError,
  classifySupabaseError,
} from '@/lib/supabase'

export function formatAuthError(
  message: string,
  details?: { status?: number; code?: string },
): string {
  const lower = message.toLowerCase()

  if (lower.includes('signups are disabled')) {
    return 'Cadastro por e-mail desativado no Supabase. Crie usuários em Authentication → Users.'
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Credenciais inválidas. Verifique e-mail e senha.'
  }

  if (
    details?.status === 521
    || lower.includes('failed to fetch')
    || lower.includes('web server is down')
    || isFailedToFetchError({ message, name: 'TypeError' } as Error)
  ) {
    return formatSupabaseError(message, details)
  }

  const cause = classifySupabaseError({ message, ...details })
  if (cause === 'auth_jwt_expired' || cause === 'auth_session') {
    return 'Sessão expirada ou inválida. Faça login novamente.'
  }
  if (cause === 'rls_denied') {
    return 'Acesso negado pelas políticas de segurança (RLS).'
  }

  return formatDetailedError({ message, ...details })
}

export async function loginTestUser(email: string, password: string) {
  const configError = getSupabaseConfigError()
  if (configError) return { error: configError }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) return { error: null }

    console.error('Erro no Supabase:', error)
    return { error: formatAuthError(error.message, { status: error.status, code: error.code }) }
  } catch (err) {
    console.error('Erro no Supabase:', err)
    const message = err instanceof Error ? err.message : 'Erro de conexão'
    return { error: formatAuthError(message) }
  }
}

export { supabaseConfig, formatSupabaseError, formatDetailedError }
