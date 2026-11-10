import { createClient, type Session } from '@supabase/supabase-js'
import {
  isRetryableHttpStatus,
  isTransientSupabaseError,
  notifySupabaseUnavailable,
  supabaseFetch,
  SUPABASE_UNAVAILABLE_MESSAGE,
} from '@/lib/supabaseResilience'

const PLACEHOLDER_URL_MARKERS = ['SEU-PROJETO', 'your-project', 'example.supabase.co', 'unconfigured.invalid']
const PLACEHOLDER_KEY_MARKERS = ['sua-anon-key', 'your-anon-key', 'anon-key-aqui', 'unconfigured']

/** Anon key é pública por design; o RLS do projeto protege os dados. Fallback para o GitHub Pages sem Secrets. */
const FALLBACK_SUPABASE_URL = 'https://aechddecxuvysrgpbord.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlY2hkZGVjeHV2eXNyZ3Bib3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjgyNTUsImV4cCI6MjEwMjA0NDI1NX0.598xZ0Vrw0vx93dpfc7wdSy3w9bWOqYTf3B_OqFtbbg'

function resolvePublicSupabaseEnv(value: string | undefined, fallback: string, markers: string[]) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return fallback
  const lower = trimmed.toLowerCase()
  if (markers.some(marker => lower.includes(marker.toLowerCase()))) return fallback
  return trimmed
}

const supabaseUrl = resolvePublicSupabaseEnv(
  import.meta.env.VITE_SUPABASE_URL,
  FALLBACK_SUPABASE_URL,
  PLACEHOLDER_URL_MARKERS,
)
const supabaseAnonKey = resolvePublicSupabaseEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  FALLBACK_SUPABASE_ANON_KEY,
  PLACEHOLDER_KEY_MARKERS,
)

export { SUPABASE_UNAVAILABLE_MESSAGE } from '@/lib/supabaseResilience'

export const NETWORK_ERROR_USER_MESSAGE =
  'Erro de Conexão de Rede: Não foi possível alcançar o servidor do Supabase. Se você estiver em uma rede corporativa/faculdade, mude para a rede do celular (4G) ou verifique se um AdBlock/Firewall está bloqueando o acesso.'

/** Origens locais comuns — cadastre também no Supabase (Authentication → URL Configuration). */
export const LOCAL_DEV_AUTH_ORIGINS = ['http://localhost:5173'] as const

/** Origem do app no browser; fallback dev = http://localhost:5173 (porta do Vite). */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return import.meta.env.DEV ? LOCAL_DEV_AUTH_ORIGINS[0] : ''
}

export function getOAuthRedirectUrl(): string {
  return getAppOrigin() || LOCAL_DEV_AUTH_ORIGINS[0]
}

export function isKnownLocalDevOrigin(origin: string): boolean {
  return (LOCAL_DEV_AUTH_ORIGINS as readonly string[]).includes(origin)
}

/** Healthcheck com "Failed to fetch" não bloqueia rotas — só exibe aviso. */
export function shouldBlockAppOnNetworkError(): boolean {
  return false
}

export function getNetworkErrorUserMessage(): string {
  const origin = getAppOrigin()
  if (import.meta.env.DEV && origin) {
    return `${NETWORK_ERROR_USER_MESSAGE} Origem atual: ${origin}. Se usar OAuth, inclua esta URL em Redirect URLs no Supabase.`
  }
  return NETWORK_ERROR_USER_MESSAGE
}

export const supabaseConfig = {
  get url() {
    return supabaseUrl
  },
  get anonKey() {
    return supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}…` : ''
  },
  get source() {
    return supabaseUrl && supabaseAnonKey ? 'env' : 'missing'
  },
  get isConfigured() {
    return getSupabaseConfigError() === null
  },
}

/** createClient exige strings não vazias; placeholders evitam crash quando .env está ausente. */
export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.invalid',
  supabaseAnonKey || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'frotamaq-web',
      },
      fetch: supabaseFetch,
    },
  },
)

if (import.meta.env.DEV) {
  const configError = getSupabaseConfigError()
  if (configError) {
    console.warn('[Supabase] Configuração incompleta:', configError)
  } else {
    console.log('[Supabase] Cliente inicializado (variáveis VITE_SUPABASE_* OK).')
  }
}

export interface SupabaseErrorDetails {
  status?: number
  code?: string
  message?: string
  details?: string
  hint?: string
  name?: string
}

export type SupabaseFailureCause =
  | 'config_missing'
  | 'config_invalid'
  | 'network'
  | 'unavailable'
  | 'auth_session'
  | 'auth_jwt_expired'
  | 'rls_denied'
  | 'database'
  | 'unknown'

const FAILURE_LOG_HINT: Record<SupabaseFailureCause, string> = {
  config_missing: 'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env e reinicie o dev server.',
  config_invalid: 'Corrija a URL ou a anon key no .env (Dashboard → Project Settings → API).',
  network: NETWORK_ERROR_USER_MESSAGE,
  unavailable: SUPABASE_UNAVAILABLE_MESSAGE,
  auth_session: 'Faça login novamente. Sem sessão, o RLS pode bloquear leituras.',
  auth_jwt_expired: 'Token expirado — o cliente tentará refresh automático; se persistir, saia e entre de novo.',
  rls_denied: 'Política RLS rejeitou a operação. Verifique perfil/empresa_id do usuário e políticas no Supabase.',
  database: 'Erro PostgREST/SQL — veja code, details e hint no log.',
  unknown: 'Erro não classificado — veja a mensagem original.',
}

export function isFailedToFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const msg = String((err as { message: unknown }).message).toLowerCase()
      return msg.includes('failed to fetch') || msg.includes('network')
    }
    return false
  }
  const msg = err.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    err.name === 'TypeError'
  )
}

function isPlaceholderValue(value: string, markers: string[]) {
  const lower = value.toLowerCase()
  return markers.some(m => lower.includes(m.toLowerCase()))
}

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Copie .env.example para .env e preencha as chaves do projeto.'
  }
  if (isPlaceholderValue(supabaseUrl, PLACEHOLDER_URL_MARKERS)) {
    return 'VITE_SUPABASE_URL ainda está com placeholder. Substitua pelo Project URL do Supabase.'
  }
  if (isPlaceholderValue(supabaseAnonKey, PLACEHOLDER_KEY_MARKERS)) {
    return 'VITE_SUPABASE_ANON_KEY ainda está com placeholder. Cole a chave anon public do Supabase.'
  }
  if (!supabaseUrl.includes('supabase.co')) {
    return `VITE_SUPABASE_URL inválida (esperado *.supabase.co): ${supabaseUrl}`
  }
  if (supabaseAnonKey.length < 20) {
    return 'VITE_SUPABASE_ANON_KEY parece incompleta — verifique a chave anon no dashboard.'
  }
  return null
}

export function classifySupabaseError(error: {
  message?: string
  code?: string
  status?: number
}): SupabaseFailureCause {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toUpperCase()

  if (code === 'CONFIG_MISSING') return 'config_missing'

  if (isRetryableHttpStatus(error.status) || msg.includes('web server is down') || /\b521\b/.test(msg)) {
    return 'unavailable'
  }

  if (
    msg.includes('jwt expired') ||
    code === 'PGRST301' ||
    (error.status === 401 && msg.includes('jwt'))
  ) {
    return 'auth_jwt_expired'
  }

  if (
    error.status === 401 ||
    msg.includes('not authenticated') ||
    msg.includes('invalid claim') ||
    (code === 'PGRST116' && msg.includes('session'))
  ) {
    return 'auth_session'
  }

  if (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('permission denied')
  ) {
    return 'rls_denied'
  }

  if (isFailedToFetchError({ message: error.message, name: 'Error' } as Error)) {
    return 'network'
  }

  if (code.startsWith('PGRST') || code.startsWith('23') || error.status === 400) {
    return 'database'
  }

  return 'unknown'
}

export function logSupabaseFailure(operation: string, cause: SupabaseFailureCause, error: unknown) {
  const hint = FAILURE_LOG_HINT[cause]
  const payload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: import.meta.env.DEV ? error.stack : undefined }
      : error

  const prefix = `[Supabase/${operation}] ${cause}`
  if (cause === 'network' || cause === 'unavailable' || cause === 'config_missing' || cause === 'config_invalid') {
    console.error(prefix, hint, payload)
  } else if (cause === 'rls_denied' || cause === 'auth_jwt_expired' || cause === 'auth_session') {
    console.warn(prefix, hint, payload)
  } else {
    console.error(prefix, hint, payload)
  }
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

export function formatSupabaseError(message: string, details?: SupabaseErrorDetails): string {
  if (isTransientSupabaseError({ message, status: details?.status, code: details?.code })) {
    return SUPABASE_UNAVAILABLE_MESSAGE
  }
  const cause = classifySupabaseError({ message, ...details })
  if (cause === 'unavailable' || cause === 'network') {
    return SUPABASE_UNAVAILABLE_MESSAGE
  }
  if (cause === 'auth_jwt_expired' || cause === 'auth_session') {
    return 'Sessão expirada ou inválida. Faça login novamente.'
  }
  if (cause === 'rls_denied') {
    return 'Acesso negado pelas políticas de segurança (RLS). Verifique seu perfil e empresa.'
  }
  return formatDetailedError({ message, ...details })
}

export interface SupabaseHealthResult {
  configured: boolean
  configError: string | null
  authOk: boolean
  dbOk: boolean
  networkError: boolean
  unavailable: boolean
  hasSession: boolean
  sessionExpiresAt: number | null
  messages: string[]
}

let healthCheckPromise: Promise<SupabaseHealthResult> | null = null

/** Healthcheck único (deduplicado) ao carregar a app — auth.getSession + ping leve em `usuarios`. */
export async function getSupabaseHealthCheck(options?: { force?: boolean }): Promise<SupabaseHealthResult> {
  if (options?.force) healthCheckPromise = null
  if (!healthCheckPromise) {
    healthCheckPromise = performSupabaseHealthCheck()
  }
  return healthCheckPromise
}

export function resetSupabaseHealthCheck() {
  healthCheckPromise = null
}

/** Apenas para testes — força novo healthcheck na próxima chamada. */
export function resetSupabaseHealthCheckForTests() {
  resetSupabaseHealthCheck()
}

const HEALTHCHECK_TIMEOUT_MS = 8_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function emptyHealthResult(overrides: Partial<SupabaseHealthResult> = {}): SupabaseHealthResult {
  return {
    configured: true,
    configError: null,
    authOk: false,
    dbOk: false,
    networkError: false,
    unavailable: false,
    hasSession: false,
    sessionExpiresAt: null,
    messages: [],
    ...overrides,
  }
}

async function performSupabaseHealthCheck(): Promise<SupabaseHealthResult> {
  const configError = getSupabaseConfigError()
  const messages: string[] = []
  let authOk = false
  let dbOk = false
  let networkError = false
  let unavailable = false
  let hasSession = false
  let sessionExpiresAt: number | null = null

  console.group('[Supabase] Healthcheck')

  if (configError) {
    console.error('[Supabase] Config inválida — requisições ao banco foram bloqueadas.', configError)
    console.groupEnd()
    return emptyHealthResult({
      configured: false,
      configError,
      messages: [configError],
    })
  }

  try {
    const sessionState = await withTimeout(ensureSupabaseSession('healthcheck'), HEALTHCHECK_TIMEOUT_MS, 'auth')
    hasSession = Boolean(sessionState.session)
    sessionExpiresAt = sessionState.session?.expires_at ?? null

    if (sessionState.error) {
      const cause = classifySupabaseError({ message: sessionState.error })
      unavailable = cause === 'unavailable' || cause === 'network'
      networkError = cause === 'network' || unavailable
      messages.push(sessionState.error)
      logSupabaseFailure('healthcheck.getSession', cause, sessionState.error)
    } else {
      authOk = true
      console.log('[Supabase] Auth OK', {
        hasSession,
        userId: sessionState.session?.user?.id ?? null,
        expiresAt: sessionExpiresAt,
      })
    }
  } catch (err) {
    unavailable = isTransientSupabaseError(err)
    networkError = unavailable || isFailedToFetchError(err)
    messages.push(err instanceof Error ? err.message : 'Exceção em getSession')
    logSupabaseFailure('healthcheck.getSession', unavailable ? 'unavailable' : 'unknown', err)
  }

  try {
    const { error: dbError } = await withTimeout(
      Promise.resolve(supabase.from('usuarios').select('id', { head: true, count: 'exact' })),
      HEALTHCHECK_TIMEOUT_MS,
      'database',
    )

    if (dbError) {
      const cause = classifySupabaseError(dbError)
      logSupabaseFailure('healthcheck.usuarios', cause, dbError)
      messages.push(`usuarios: ${formatDetailedError(dbError)}`)
      if (cause === 'unavailable' || cause === 'network') {
        unavailable = true
        networkError = true
      }
    } else {
      dbOk = true
      console.log('[Supabase] PostgREST / usuarios OK')
    }
  } catch (err) {
    unavailable = unavailable || isTransientSupabaseError(err)
    networkError = networkError || unavailable || isFailedToFetchError(err)
    logSupabaseFailure('healthcheck.usuarios', unavailable ? 'unavailable' : 'unknown', err)
    messages.push(err instanceof Error ? err.message : 'Exceção ao consultar usuarios')
  }

  if (unavailable || networkError) {
    notifySupabaseUnavailable(undefined, 'network')
    console.warn('[Supabase]', SUPABASE_UNAVAILABLE_MESSAGE)
  }

  console.groupEnd()

  return {
    configured: true,
    configError: null,
    authOk,
    dbOk,
    networkError,
    unavailable: unavailable || networkError,
    hasSession,
    sessionExpiresAt,
    messages,
  }
}

/**
 * Garante leitura da sessão persistida (localStorage) para que o cliente envie o JWT nas requisições RLS.
 */
function readPersistedSession(): Session | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const host = new URL(supabaseUrl).hostname
    const projectRef = host.split('.')[0]
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session & { currentSession?: Session }
    return parsed.currentSession ?? parsed
  } catch {
    return null
  }
}

export async function ensureSupabaseSession(context: string): Promise<{
  session: Session | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      if (isTransientSupabaseError(error)) {
        notifySupabaseUnavailable(error.status, 'http')
        return { session: data.session ?? readPersistedSession(), error: null }
      }
      return { session: data.session ?? null, error: formatDetailedError(error) }
    }

    const session = data.session
    if (!session) {
      if (import.meta.env.DEV) {
        console.log(`[Supabase/${context}] Sem sessão — queries autenticadas dependem de login.`)
      }
      return { session: null, error: null }
    }

    const expiresAtMs = (session.expires_at ?? 0) * 1000
    if (expiresAtMs > 0 && Date.now() > expiresAtMs - 60_000) {
      try {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          if (isTransientSupabaseError(refreshError)) {
            notifySupabaseUnavailable(refreshError.status, 'http')
            return { session, error: null }
          }
          logSupabaseFailure(`${context}.refreshSession`, 'auth_jwt_expired', refreshError)
          return { session, error: formatDetailedError(refreshError) }
        }
        if (refreshed.session) {
          console.log(`[Supabase/${context}] Sessão renovada para RLS.`)
          return { session: refreshed.session, error: null }
        }
      } catch (err) {
        if (isTransientSupabaseError(err)) {
          notifySupabaseUnavailable(undefined, 'network')
          return { session, error: null }
        }
        throw err
      }
    }

    return { session, error: null }
  } catch (err) {
    if (isTransientSupabaseError(err)) {
      notifySupabaseUnavailable(undefined, 'network')
      return { session: readPersistedSession(), error: null }
    }
    return { session: null, error: err instanceof Error ? err.message : 'Falha ao ler a sessão' }
  }
}

/** @deprecated Use getSupabaseHealthCheck */
export async function runInitialConnectionTest() {
  const h = await getSupabaseHealthCheck()
  return {
    authOk: h.authOk,
    dbOk: h.dbOk,
    networkError: h.networkError,
    messages: h.messages,
  }
}

export async function runSupabaseDiagnostics() {
  return getSupabaseHealthCheck()
}

export async function checkSupabaseConnection() {
  const result = await getSupabaseHealthCheck()
  const error = result.configError
    ?? (result.unavailable || result.networkError ? SUPABASE_UNAVAILABLE_MESSAGE : result.messages[0] ?? null)

  return {
    ok: result.configured && result.authOk && !result.networkError && !result.unavailable,
    error,
    networkError: result.networkError || result.unavailable ? SUPABASE_UNAVAILABLE_MESSAGE : null,
  }
}

export async function testSupabaseRest() {
  const configError = getSupabaseConfigError()
  if (configError) return { ok: false, error: configError }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
    if (!res.ok) {
      return { ok: false, error: `REST ping HTTP ${res.status}` }
    }
    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: isTransientSupabaseError(err)
        ? SUPABASE_UNAVAILABLE_MESSAGE
        : (err instanceof Error ? err.message : 'Falha no ping REST'),
    }
  }
}

export function getSupabaseNetworkError(): string | null {
  return null
}
