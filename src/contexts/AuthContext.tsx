import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import {
  supabase,
  getSupabaseConfigError,
  getSupabaseHealthCheck,
  ensureSupabaseSession,
  logSupabaseFailure,
  classifySupabaseError,
  formatSupabaseError,
  getOAuthRedirectUrl,
} from '@/lib/supabase'
import { isTransientSupabaseError } from '@/lib/supabaseResilience'
import { runSupabaseQuery } from '@/lib/supabaseQuery'
import { formatAuthError } from '@/lib/seedTestUsers'
import { TENANT_STORAGE_KEY } from '@/lib/tenantFilter'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import type { PerfilUsuario, Usuario } from '@/types/database'

interface SignUpData {
  email: string
  password: string
  nome: string
  perfil: PerfilUsuario
  empresa_id?: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Usuario | null
  loading: boolean
  connectionError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (data: SignUpData) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const PROFILE_CACHE_KEY = 'frotamaq:last-profile'

function readCachedProfile(): Usuario | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? JSON.parse(raw) as Usuario : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: Usuario | null) {
  try {
    if (!profile) localStorage.removeItem(PROFILE_CACHE_KEY)
    else localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    /* ignore quota / private mode */
  }
}

function profileFromUser(user: User): Usuario {
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? '',
    nome: String(metadata.nome ?? user.email ?? 'Usuário'),
    perfil: (metadata.perfil as Usuario['perfil']) || 'motorista',
    empresa_id: typeof metadata.empresa_id === 'string' ? metadata.empresa_id : null,
    created_at: user.created_at ?? new Date().toISOString(),
  }
}

async function upsertUsuarioProfile(
  userId: string,
  email: string,
  nome: string,
  perfil: PerfilUsuario,
  empresa_id: string | null | undefined,
) {
  const { error } = await supabase.from('usuarios').upsert(
    {
      id: userId,
      email,
      nome,
      perfil,
      empresa_id: empresa_id ?? null,
    },
    { onConflict: 'id' },
  )

  if (error) {
    console.error('[Supabase] upsert usuarios:', error)
    return error
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  async function fetchProfile(userId: string) {
    await ensureSupabaseSession('fetchProfile')

    const { data, error } = await runSupabaseQuery('auth.fetchProfile', () =>
      supabase.from('usuarios').select('*').eq('id', userId).single(),
    )

    if (error) {
      const fallback = readCachedProfile()
      if (fallback?.id === userId) setProfile(fallback)
      return
    }
    if (data) {
      setProfile(data)
      writeCachedProfile(data)
    }
  }

  useEffect(() => {
    async function init() {
      const configError = getSupabaseConfigError()
      if (configError) {
        setConnectionError(configError)
        setLoading(false)
        return
      }

      getSupabaseHealthCheck().then(test => {
        if (test.configError) {
          setConnectionError(test.configError)
          return
        }
        if (test.unavailable || test.networkError) {
          logSupabaseFailure('AuthProvider.healthcheck', 'unavailable', test.messages.join('; '))
          return
        }
        if (!test.authOk) {
          setConnectionError(test.messages[0] ?? 'Falha ao conectar com Auth do Supabase.')
        } else if (!test.dbOk) {
          console.warn('[Supabase] Auth OK, mas tabela usuarios falhou. Execute o SQL de schema no Supabase.')
        }
      }).catch(err => {
        logSupabaseFailure('AuthProvider.healthcheck', classifySupabaseError(err instanceof Error ? err : {}), err)
      })

      try {
        const { session: s, error: sessionError } = await ensureSupabaseSession('AuthProvider.init')

        if (sessionError && !isTransientSupabaseError({ message: sessionError })) {
          setConnectionError(formatSupabaseError(sessionError))
        } else {
          setSession(s)
          setUser(s?.user ?? null)
          if (s?.user) {
            const cached = readCachedProfile()
            if (cached?.id === s.user.id) setProfile(cached)
            else setProfile(profileFromUser(s.user))
            void fetchProfile(s.user.id)
          }
        }
      } catch (err) {
        logSupabaseFailure('AuthProvider.init', classifySupabaseError(err instanceof Error ? err : {}), err)
        if (!isTransientSupabaseError(err)) {
          setConnectionError(err instanceof Error ? err.message : 'Erro desconhecido')
        }
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        localStorage.removeItem(TENANT_STORAGE_KEY)
        fetchProfile(s.user.id)
      } else {
        setProfile(null)
        localStorage.removeItem(TENANT_STORAGE_KEY)
        notifyDataRefresh()
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('Erro no Supabase:', error)
        return { error: formatAuthError(error.message, { status: error.status, code: error.code }) }
      }

      if (data.session) {
        localStorage.removeItem(TENANT_STORAGE_KEY)
        setSession(data.session)
        setUser(data.session.user)
        if (data.user) await fetchProfile(data.user.id)
        notifyDataRefresh()
      }

      return { error: null }
    } catch (err) {
      console.error('Erro no Supabase:', err)
      const message = err instanceof Error ? err.message : 'Erro de conexão'
      return { error: formatAuthError(message) }
    }
  }

  async function signUp({ email, password, nome, perfil, empresa_id }: SignUpData) {
    try {
      const metadata: Record<string, string> = { nome, perfil }
      if (empresa_id) metadata.empresa_id = empresa_id

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      })

      if (error) {
        console.error('Erro no Supabase:', error)
        return { error: formatAuthError(error.message, { status: error.status, code: error.code }), needsConfirmation: false }
      }

      if (data.user) {
        await upsertUsuarioProfile(data.user.id, email, nome, perfil, empresa_id ?? null)
      }

      if (data.user && data.session) {
        await fetchProfile(data.user.id)
        notifyDataRefresh()
        return { error: null, needsConfirmation: false }
      }

      return { error: null, needsConfirmation: true }
    } catch (err) {
      console.error('Erro no Supabase:', err)
      return {
        error: formatAuthError(err instanceof Error ? err.message : 'Erro de conexão'),
        needsConfirmation: false,
      }
    }
  }

  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectUrl() },
      })

      if (error) {
        console.error('Erro no Supabase:', error)
        return { error: formatAuthError(error.message, { status: error.status, code: error.code }) }
      }

      return { error: null }
    } catch (err) {
      console.error('Erro no Supabase:', err)
      return { error: formatAuthError(err instanceof Error ? err.message : 'Erro de conexão') }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    writeCachedProfile(null)
    localStorage.removeItem(TENANT_STORAGE_KEY)
    notifyDataRefresh()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, connectionError, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
