import type { PostgrestError } from '@supabase/supabase-js'
import {
  classifySupabaseError,
  getSupabaseConfigError,
  logSupabaseFailure,
  type SupabaseFailureCause,
} from '@/lib/supabase'
import { isTransientSupabaseError } from '@/lib/supabaseResilience'

type QueryResult = { error: PostgrestError | Error | null }

function configBlockedError(): PostgrestError {
  const message = getSupabaseConfigError() ?? 'Supabase não configurado.'
  return {
    message,
    details: '',
    hint: 'Copie .env.example para .env e reinicie o npm run dev.',
    code: 'CONFIG_MISSING',
  } as PostgrestError
}

function networkPostgrestError(err: unknown): PostgrestError {
  const message = err instanceof Error ? err.message : 'Falha de rede ao contactar o Supabase.'
  return {
    message,
    details: '',
    hint: 'Verifique internet, VPN, firewall ou AdBlock.',
    code: 'NETWORK_ERROR',
  } as PostgrestError
}

/**
 * Executa uma query PostgREST com validação de config, try/catch e logs classificados (RLS, JWT, rede).
 */
export async function runSupabaseQuery<T extends QueryResult>(
  operation: string,
  queryFn: () => PromiseLike<T>,
): Promise<T> {
  const configError = getSupabaseConfigError()
  if (configError) {
    logSupabaseFailure(operation, 'config_missing', configError)
    return { error: configBlockedError() } as T
  }

  try {
    const result = await queryFn()
    if (result.error) {
      const cause = classifySupabaseError(result.error)
      logSupabaseFailure(operation, cause, result.error)
    }
    return result
  } catch (err) {
    const cause: SupabaseFailureCause = isTransientSupabaseError(err) ? 'unavailable' : 'unknown'
    logSupabaseFailure(operation, cause, err)
    return { error: networkPostgrestError(err) } as T
  }
}
