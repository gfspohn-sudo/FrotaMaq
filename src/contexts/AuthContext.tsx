import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, getSupabaseConfigError, runInitialConnectionTest } from '@/lib/supabase'
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
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Supabase] fetchProfile(usuarios):', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      })
      return
    }

    if (data) setProfile(data)
  }

  useEffect(() => {
    async function init() {
      const configError = getSupabaseConfigError()
      if (configError) {
        setConnectionError(configError)
        setLoading(false)
        return
      }

      const test = await runInitialConnectionTest()
      if (test.networkError) {
        setConnectionError(
          'Erro de Conexão de Rede: não foi possível alcançar o Supabase. Teste com 4G ou desative AdBlock/VPN.',
        )
      } else if (!test.authOk) {
        setConnectionError(test.messages[0] ?? 'Falha ao conectar com Auth do Supabase.')
      } else if (!test.dbOk) {
        console.warn('[Supabase] Auth OK, mas tabela usuarios falhou. Execute fix_database.sql.')
      }

      try {
        const { data: { session: s }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Erro no Supabase:', error)
          setConnectionError(formatAuthError(error.message, { status: error.status, code: error.code }))
        } else {
          setSession(s)
          setUser(s?.user ?? null)
          if (s?.user) await fetchProfile(s.user.id)
        }
      } catch (err) {
        console.error('Erro no Supabase:', err)
        setConnectionError(err instanceof Error ? err.message : 'Erro desconhecido')
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
        options: { redirectTo: window.location.origin },
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
