import { describe, expect, it } from 'vitest'
import { classifySupabaseError, isFailedToFetchError, formatSupabaseError } from '@/lib/supabase'
import { SUPABASE_UNAVAILABLE_MESSAGE } from '@/lib/supabaseResilience'

describe('classifySupabaseError', () => {
  it('identifica JWT expirado', () => {
    expect(classifySupabaseError({ message: 'JWT expired', code: 'PGRST301' })).toBe('auth_jwt_expired')
  })

  it('identifica negação RLS', () => {
    expect(classifySupabaseError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(
      'rls_denied',
    )
  })

  it('identifica falha de rede pela mensagem', () => {
    expect(classifySupabaseError({ message: 'Failed to fetch' })).toBe('network')
  })

  it('identifica Cloudflare 521 como unavailable', () => {
    expect(classifySupabaseError({ status: 521, message: 'error code: 521' })).toBe('unavailable')
    expect(formatSupabaseError('error code: 521', { status: 521 })).toBe(SUPABASE_UNAVAILABLE_MESSAGE)
  })
})

describe('isFailedToFetchError', () => {
  it('reconhece TypeError de fetch', () => {
    expect(isFailedToFetchError(new TypeError('Failed to fetch'))).toBe(true)
  })
})
