import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isRetryableHttpStatus,
  isTransientSupabaseError,
  resetSupabaseConnectivityForTests,
  resilientSupabaseFetch,
  SUPABASE_UNAVAILABLE_MESSAGE,
} from '@/lib/supabaseResilience'
import { classifySupabaseError, formatSupabaseError } from '@/lib/supabase'

describe('resiliência do cliente Supabase', () => {
  afterEach(() => {
    resetSupabaseConnectivityForTests()
  })

  it('reconhece HTTP 521 como retryable', () => {
    expect(isRetryableHttpStatus(521)).toBe(true)
    expect(isRetryableHttpStatus(200)).toBe(false)
  })

  it('classifica 521 como unavailable', () => {
    expect(classifySupabaseError({ status: 521, message: 'Web Server Is Down' })).toBe('unavailable')
    expect(formatSupabaseError('Web Server Is Down', { status: 521 })).toBe(SUPABASE_UNAVAILABLE_MESSAGE)
  })

  it('trata Failed to fetch como erro transitório', () => {
    expect(isTransientSupabaseError(new TypeError('Failed to fetch'))).toBe(true)
    expect(formatSupabaseError('Failed to fetch')).toBe(SUPABASE_UNAVAILABLE_MESSAGE)
  })

  it('tenta novamente 2 vezes após 521 e devolve sucesso', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('down', { status: 521 }))
      .mockResolvedValueOnce(new Response('down', { status: 521 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const response = await resilientSupabaseFetch('https://example.supabase.co/auth/v1/health', undefined, {
      fetchImpl,
      delayMs: 0,
      timeoutMs: 1_000,
    })

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('esgota as tentativas e devolve o último 521', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('down', { status: 521 }))

    const response = await resilientSupabaseFetch('https://example.supabase.co/rest/v1/', undefined, {
      fetchImpl,
      delayMs: 0,
      timeoutMs: 1_000,
    })

    expect(response.status).toBe(521)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('repete falha de rede e só então propaga a exceção', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      resilientSupabaseFetch('https://example.supabase.co/auth/v1/token', undefined, {
        fetchImpl,
        delayMs: 0,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow('Failed to fetch')

    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
