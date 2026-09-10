import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'

interface HeaderProps {
  title?: string
  showGreeting?: boolean
}

export function Header({ title, showGreeting = false }: HeaderProps) {
  const { profile } = useAuth()
  const firstName = profile?.nome?.split(' ')[0] ?? 'Usuário'

  return (
    <header className="bg-navy-900 px-4 py-5 text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          {showGreeting ? (
            <>
              <p className="text-sm text-gray-300">Bem-vindo de volta</p>
              <h1 className="text-xl font-semibold">Olá, {firstName}!</h1>
            </>
          ) : (
            <h1 className="text-xl font-semibold">{title}</h1>
          )}
        </div>
        <Link
          to="/alertas"
          className="relative rounded-lg p-2 hover:bg-white/10 transition-colors"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </div>
    </header>
  )
}
