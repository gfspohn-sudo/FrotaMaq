export const SUPABASE_UNAVAILABLE_MESSAGE =
  'O servidor de banco de dados está inicializando ou temporariamente indisponível. Reconectando em instantes...'

export const RETRYABLE_HTTP_STATUS = new Set([521, 522, 523, 524, 502, 503, 504])
export const SUPABASE_FETCH_MAX_ATTEMPTS = 3
export const SUPABASE_FETCH_TIMEOUT_MS = 4_000
export const SUPABASE_FETCH_RETRY_DELAY_MS = 350

export type SupabaseConnectivityState = {
  unavailable: boolean
  status: number | null
  reason: 'http' | 'network' | null
  updatedAt: number
}

type ConnectivityListener = (state: SupabaseConnectivityState) => void

const listeners = new Set<ConnectivityListener>()

let connectivity: SupabaseConnectivityState = {
  unavailable: false,
  status: null,
  reason: null,
  updatedAt: 0,
}

export function getSupabaseConnectivity(): SupabaseConnectivityState {
  return connectivity
}

export function subscribeSupabaseConnectivity(listener: ConnectivityListener): () => void {
  listeners.add(listener)
  listener(connectivity)
  return () => {
    listeners.delete(listener)
  }
}

export function notifySupabaseUnavailable(status?: number, reason: 'http' | 'network' = status ? 'http' : 'network') {
  setConnectivity({
    unavailable: true,
    status: status ?? null,
    reason,
    updatedAt: Date.now(),
  })
}

export function notifySupabaseAvailable() {
  if (!connectivity.unavailable && connectivity.reason == null) return
  setConnectivity({
    unavailable: false,
    status: null,
    reason: null,
    updatedAt: Date.now(),
  })
}

function setConnectivity(next: SupabaseConnectivityState) {
  const changed =
    next.unavailable !== connectivity.unavailable
    || next.status !== connectivity.status
    || next.reason !== connectivity.reason

  connectivity = next
  if (!changed && next.unavailable === connectivity.unavailable) return
  listeners.forEach(listener => listener(next))
}

export function isRetryableHttpStatus(status?: number | null): boolean {
  return typeof status === 'number' && RETRYABLE_HTTP_STATUS.has(status)
}

export function isTransientSupabaseError(error: unknown): boolean {
  if (error == null) return false

  if (typeof error === 'object') {
    const status = 'status' in error ? Number((error as { status?: number }).status) : NaN
    if (isRetryableHttpStatus(status)) return true
    const code = 'code' in error ? String((error as { code?: string }).code) : ''
    if (code === 'NETWORK_ERROR' || code === 'UND_ERR_CONNECT_TIMEOUT') return true
  }

  if (typeof error === 'number' && isRetryableHttpStatus(error)) return true

  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)

  const lower = message.toLowerCase()
  const name = error instanceof Error ? error.name : ''

  return (
    lower.includes('failed to fetch')
    || lower.includes('networkerror')
    || lower.includes('network request failed')
    || lower.includes('load failed')
    || lower.includes('err_connection')
    || lower.includes('web server is down')
    || /\b52[1234]\b/.test(lower)
    || lower.includes('timeout')
    || name === 'AbortError'
    || name === 'TypeError'
  )
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

interface ResilientFetchOptions {
  fetchImpl?: typeof fetch
  maxAttempts?: number
  timeoutMs?: number
  delayMs?: number
  sleepImpl?: (ms: number) => Promise<void>
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const parentSignal = init?.signal

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function resilientSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = options.maxAttempts ?? SUPABASE_FETCH_MAX_ATTEMPTS
  const timeoutMs = options.timeoutMs ?? SUPABASE_FETCH_TIMEOUT_MS
  const delayMs = options.delayMs ?? SUPABASE_FETCH_RETRY_DELAY_MS
  const sleepImpl = options.sleepImpl ?? sleep

  let lastError: unknown
  let lastResponse: Response | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(fetchImpl, input, init, timeoutMs)
      lastResponse = response

      if (!isRetryableHttpStatus(response.status)) {
        notifySupabaseAvailable()
        return response
      }

      notifySupabaseUnavailable(response.status, 'http')
      if (attempt === maxAttempts) return response
      await sleepImpl(delayMs * attempt)
    } catch (err) {
      lastError = err
      if (!isTransientSupabaseError(err) || attempt === maxAttempts) {
        notifySupabaseUnavailable(undefined, 'network')
        throw err
      }
      notifySupabaseUnavailable(undefined, 'network')
      await sleepImpl(delayMs * attempt)
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error(SUPABASE_UNAVAILABLE_MESSAGE)
}

/** Fetch usado pelo cliente Supabase — retries em 521/rede antes de propagar a falha. */
export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return resilientSupabaseFetch(input, init)
}

export function resetSupabaseConnectivityForTests() {
  connectivity = {
    unavailable: false,
    status: null,
    reason: null,
    updatedAt: 0,
  }
  listeners.clear()
}
