import { Languages, Menu, Moon, Sun } from 'lucide-react'
import { PERFIL_LABELS } from '@/lib/tenantFilter'
import { getInitials } from '@/lib/uiHelpers'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/contexts/I18nContext'
import { useTheme } from '@/contexts/ThemeContext'
import { NotificationBell } from '@/components/layout/NotificationBell'

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  const firstName = profile?.nome?.split(' ')[0] ?? 'Usuário'
  const roleLabel = profile?.perfil ? PERFIL_LABELS[profile.perfil] : ''

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-muted lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-action/10 text-xs font-semibold text-action lg:hidden">
            {getInitials(profile?.nome)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">{t('greeting.welcome')}</p>
            <p className="truncate text-sm font-semibold text-fg sm:text-base">
              {t('greeting.hello')}, {firstName}
            </p>
          </div>
          {roleLabel && (
            <span className="hidden rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-fg-muted sm:inline-flex">
              {roleLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLocale(locale === 'pt-BR' ? 'en-US' : 'pt-BR')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            aria-label={t('locale.label')}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{locale === 'pt-BR' ? 'PT' : 'EN'}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
