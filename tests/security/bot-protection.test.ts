import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createAnonClient, isLiveSupabaseConfigured } from './helpers'

const live = isLiveSupabaseConfigured()
const THROTTLE_STATUSES = new Set([400, 401, 429])

describe('Bot protection — rate limit de autenticação', () => {
  it('simula tentativas automatizadas e trata HTTP 429 após o limite', async () => {
    let attempt = 0
    const fetchStub: typeof fetch = async input => {
      attempt += 1
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (!url.includes('/auth/v1/token')) {
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (attempt > 3) {
        return new Response(
          JSON.stringify({ message: 'Too many requests', error: 'over_request_rate_limit' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = createClient('https://security-tests.supabase.co', 'anon-test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchStub },
    })

    const statuses: number[] = []
    for (let index = 0; index < 6; index += 1) {
      const { data, error } = await client.auth.signInWithPassword({
        email: `bot-${index}@frotamaq.invalid`,
        password: 'not-a-real-password',
      })
      expect(data.session).toBeNull()
      statuses.push(error?.status ?? 0)
    }

    expect(statuses.every(status => THROTTLE_STATUSES.has(status))).toBe(true)
    expect(statuses).toContain(429)
    expect(statuses).toContain(400)
  })

  it.skipIf(!live)('GoTrue rejeita rajada de logins inválidos com 400 ou 429', async () => {
    const client = createAnonClient()
    const statuses: number[] = []

    for (let index = 0; index < 8; index += 1) {
      const { data, error } = await client.auth.signInWithPassword({
        email: `bot-security-${index}-${Date.now()}@frotamaq.invalid`,
        password: 'invalid-bot-password',
      })
      expect(data.session).toBeNull()
      const status = error?.status ?? 0
      statuses.push(status)
      expect(THROTTLE_STATUSES.has(status)).toBe(true)
    }

    expect(statuses.some(status => status === 400 || status === 429)).toBe(true)
  }, 30_000)

  it('não aceita sessão válida em credenciais de bot', async () => {
    const fetchStub = vi.fn(async () => new Response(
      JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ))

    const client = createClient('https://security-tests.supabase.co', 'anon-test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchStub },
    })

    const { data, error } = await client.auth.signInWithPassword({
      email: 'attacker@example.com',
      password: '123456',
    })

    expect(error?.status).toBe(400)
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })
})
