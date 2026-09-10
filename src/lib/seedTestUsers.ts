import {
  supabase,
  supabaseConfig,
  getSupabaseConfigError,
  formatSupabaseError,
  formatDetailedError,
  NETWORK_ERROR_USER_MESSAGE,
  isFailedToFetchError,
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
    return 'Credenciais inválidas. Crie gerente@frotamaq.com / mecanico@frotamaq.com / motorista@frotamaq.com (senha: 123456) no painel Supabase.'
  }

  if (isFailedToFetchError({ message, name: 'TypeError' } as Error) || lower.includes('failed to fetch')) {
    return NETWORK_ERROR_USER_MESSAGE
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
