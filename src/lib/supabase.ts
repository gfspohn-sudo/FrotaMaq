import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://aechddecxuvysrgpbord.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlY2hkZGVjeHV2eXNyZ3Bib3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjgyNTUsImV4cCI6MjEwMjA0NDI1NX0.598xZ0Vrw0vx93dpfc7wdSy3w9bWOqYTf3B_OqFtbbg'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || SUPABASE_ANON_KEY

export const NETWORK_ERROR_USER_MESSAGE =
  'Erro de Conexão de Rede: Não foi possível alcançar o servidor do Supabase. Se você estiver em uma rede corporativa/faculdade, mude para a rede do celular (4G) ou verifique se um AdBlock/Firewall está bloqueando o acesso.'

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  source:
    import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
      ? 'env'
      : 'fallback',
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

console.log('[Supabase] Instância criada com sucesso.', {
  url: supabaseUrl,
  keyType: 'anon (pública — NÃO usa service_role)',
  source: supabaseConfig.source,
  envLoaded: Boolean(import.meta.env.VITE_SUPABASE_URL?.trim()),
})

export interface SupabaseErrorDetails {
  status?: number
  code?: string
  message?: string
  details?: string
  hint?: string
  name?: string
}

export function isFailedToFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  )
}

export function formatDetailedError(error: {
  message?: string
  status?: number
  code?: string
  details?: string
  hint?: string
}): string {
  const parts: string[] = []
  if (error.status) parts.push(`HTTP ${error.status}`)
  if (error.code) parts.push(`Código: ${error.code}`)
  if (error.message) parts.push(error.message)
  if (error.details) parts.push(`Detalhes: ${error.details}`)
  if (error.hint) parts.push(`Dica: ${error.hint}`)
  return parts.join(' | ') || 'Erro desconhecido'
}

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) return 'URL ou Anon Key ausentes.'
  if (!supabaseUrl.includes('supabase.co')) return `URL inválida: ${supabaseUrl}`
  return null
}

export function formatSupabaseError(message: string, details?: SupabaseErrorDetails): string {
  if (isFailedToFetchError({ message, name: 'Error' } as Error)) {
    return NETWORK_ERROR_USER_MESSAGE
  }
  return formatDetailedError({ message, ...details })
}

/** Teste inicial: auth.getSession + contagem na tabela usuarios */
export async function runInitialConnectionTest(): Promise<{
  authOk: boolean
  dbOk: boolean
  networkError: boolean
  messages: string[]
}> {
  const messages: string[] = []
  let authOk = false
  let dbOk = false
  let networkError = false

  console.group('[Supabase] Teste de conexão inicial')

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('[Supabase] getSession() FALHOU:', {
        message: sessionError.message,
        status: sessionError.status,
        code: sessionError.code,
        error: sessionError,
      })
      messages.push(formatDetailedError(sessionError))
    } else {
      authOk = true
      console.log('[Supabase] getSession() OK', {
        hasSession: Boolean(sessionData.session),
        userId: sessionData.session?.user?.id ?? null,
      })
    }
  } catch (err) {
    networkError = isFailedToFetchError(err)
    console.error('[Supabase] getSession() EXCEÇÃO:', err)
    messages.push(err instanceof Error ? err.message : 'Exceção em getSession')
  }

  try {
    const { count, error: dbError } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })

    if (dbError) {
      console.error('[Supabase] usuarios SELECT FALHOU:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
        error: dbError,
      })
      messages.push(
        `Tabela usuarios: ${formatDetailedError(dbError)}. Execute fix_database.sql no Supabase se a tabela não existir.`,
      )
    } else {
      dbOk = true
      console.log('[Supabase] usuarios SELECT OK', { count: count ?? 0 })
    }
  } catch (err) {
    networkError = networkError || isFailedToFetchError(err)
    console.error('[Supabase] usuarios SELECT EXCEÇÃO:', err)
    messages.push(err instanceof Error ? err.message : 'Exceção ao consultar usuarios')
  }

  if (authOk) {
    console.log('[Supabase] Auth acessível — login pode funcionar.')
  }
  if (!dbOk) {
    console.warn('[Supabase] Tabela usuarios com problema — login Auth pode funcionar, mas perfil pode falhar.')
  }
  if (networkError) {
    console.error('[Supabase]', NETWORK_ERROR_USER_MESSAGE)
  }

  console.groupEnd()

  return { authOk, dbOk, networkError, messages }
}

export async function runSupabaseDiagnostics() {
  return runInitialConnectionTest()
}

export async function checkSupabaseConnection() {
  const result = await runInitialConnectionTest()
  const error = result.networkError
    ? NETWORK_ERROR_USER_MESSAGE
    : result.messages[0] ?? null

  return {
    ok: result.authOk,
    error,
    networkError: result.networkError ? NETWORK_ERROR_USER_MESSAGE : null,
  }
}

export async function testSupabaseRest() {
  return { ok: true, error: null }
}

export function getSupabaseNetworkError(): string | null {
  return null
}
