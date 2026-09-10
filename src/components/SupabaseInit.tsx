import { useEffect, useState } from 'react'
import { runInitialConnectionTest, NETWORK_ERROR_USER_MESSAGE } from '@/lib/supabase'

export function SupabaseInit() {
  const [networkError, setNetworkError] = useState(false)

  useEffect(() => {
    runInitialConnectionTest().then(({ networkError: isNetwork, authOk, dbOk, messages }) => {
      if (isNetwork) setNetworkError(true)

      if (!authOk && !isNetwork) {
        console.error('[Supabase] Auth indisponível:', messages)
      }
      if (!dbOk) {
        console.warn('[Supabase] Banco/tabela usuarios — execute fix_database.sql se necessário.')
      }
    })
  }, [])

  if (!networkError) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b-2 border-danger bg-red-50 px-4 py-3 shadow-md">
      <p className="mx-auto max-w-3xl text-sm font-bold text-danger">Erro de Conexão de Rede</p>
      <p className="mx-auto mt-1 max-w-3xl text-xs text-red-800">{NETWORK_ERROR_USER_MESSAGE}</p>
    </div>
  )
}
