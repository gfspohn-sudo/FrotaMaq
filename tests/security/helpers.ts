import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = /SEU-PROJETO|your-project|example\.supabase\.co|unconfigured\.invalid/i
const PLACEHOLDER_KEY = /sua-anon-key|your-anon-key|anon-key-aqui|^unconfigured$/i

function hydrateEnvFromDotEnv() {
  const file = resolve(process.cwd(), '.env')
  if (!existsSync(file)) return

  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

hydrateEnvFromDotEnv()

export const FOREIGN_EMPRESA_ID = '00000000-0000-0000-0000-000000000099'
export const FOREIGN_RECORD_ID = '00000000-0000-0000-0000-000000000042'

export function getSupabasePublicEnv() {
  const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  return { url, anonKey }
}

export function isLiveSupabaseConfigured() {
  const { url, anonKey } = getSupabasePublicEnv()
  if (!url || !anonKey) return false
  if (PLACEHOLDER_URL.test(url) || PLACEHOLDER_KEY.test(anonKey)) return false
  return /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(url)
}

export function createAnonClient(): SupabaseClient {
  const { url, anonKey } = getSupabasePublicEnv()
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function assertZeroRows(data: unknown[] | null | undefined) {
  expect(data ?? []).toHaveLength(0)
}

export function isTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /fetch failed|Failed to fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|AbortError|timeout/i.test(message)
}
