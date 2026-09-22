import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { supabase, formatDetailedError } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SupabaseConfigAlert } from '@/components/SupabaseConfigAlert'
import { validarChaveConvite } from '@/services/inviteKeys'

type AuthMode = 'login' | 'signup'

const BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1920&q=80'

export function LoginPage() {
  const { signUp, signInWithGoogle, connectionError } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [chaveConvite, setChaveConvite] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.error('Erro no Supabase (teste login page):', sessionError)
      } else {
        console.log('[Login] Sessão atual:', data.session ? 'ativa' : 'nenhuma')
      }
    })
  }, [])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function switchMode(next: AuthMode) {
    resetMessages()
    setMode(next)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        console.error('Erro no Supabase:', signInError)
        setError(formatDetailedError(signInError))
        setLoading(false)
        return
      }

      console.log('[Supabase] Login OK:', { userId: data.user?.id, email: data.user?.email })
      navigate('/')
    } catch (err) {
      console.error('Erro no Supabase:', err)
      setError(err instanceof Error ? err.message : 'Erro de conexão inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()

    if (!chaveConvite.trim()) {
      setError('Informe a Chave de Acesso da Empresa.')
      return
    }

    setLoading(true)

    const { data: chaveData, error: chaveError } = await validarChaveConvite(chaveConvite.trim())
    if (chaveError || !chaveData) {
      setLoading(false)
      setError(chaveError?.message ?? 'Chave de convite inválida.')
      return
    }

    const { error: signUpError, needsConfirmation } = await signUp({
      email,
      password,
      nome,
      perfil: chaveData.perfil,
      empresa_id: chaveData.empresaId,
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError)
      return
    }

    if (needsConfirmation) {
      setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.')
      switchMode('login')
      return
    }

    navigate('/')
  }

  async function handleGoogleLogin() {
    resetMessages()
    const { error: googleError } = await signInWithGoogle()
    if (googleError) setError(googleError)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
      />
      <div className="absolute inset-0 bg-action/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/40 via-action/60 to-navy-900/80" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
            <Truck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">FrotaMaq</h1>
          <p className="mt-1 text-sm text-white/80">Gestão de Frotas e Máquinas</p>
        </div>

        <div className="rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'login'
                ? 'Acesse o painel de gestão da frota'
                : 'Preencha os dados para se cadastrar'}
            </p>
          </div>

          <SupabaseConfigAlert connectionError={connectionError} />

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="rounded border-gray-300 text-action focus:ring-action"
                  />
                  Lembrar-me
                </label>
                <button type="button" className="text-sm text-action hover:underline">
                  Esqueci a senha?
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  <p className="font-medium">Falha no login</p>
                  <p className="mt-1 text-xs leading-relaxed">{error}</p>
                </div>
              )}
              {success && (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{success}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>

              <p className="text-center text-sm text-gray-600">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-medium text-action hover:underline"
                >
                  Cadastre-se
                </button>
              </p>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-500">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                size="lg"
                onClick={handleGoogleLogin}
              >
                Entrar com Google
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                label="Nome"
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Input
                label="Senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <Input
                label="Chave de Acesso da Empresa"
                type="text"
                placeholder="Chave_Motorista_XXXX ou Chave_Mecanico_XXXX"
                value={chaveConvite}
                onChange={e => setChaveConvite(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                Use a chave fornecida pelo gestor da sua empresa. O perfil (Motorista ou Mecânico) é definido automaticamente pela chave.
              </p>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  <p className="font-medium">Falha no cadastro</p>
                  <p className="mt-1 text-xs">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </Button>

              <p className="text-center text-sm text-gray-600">
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-action hover:underline"
                >
                  Entrar
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
