import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type AppLocale = 'pt-BR' | 'en-US'

const STORAGE_KEY = 'frotamaq_locale'

const messages = {
  'pt-BR': {
    'app.name': 'FrotaMaq',
    'greeting.welcome': 'Bem-vindo de volta',
    'greeting.hello': 'Olá',
    'nav.home': 'Início',
    'nav.vehicles': 'Veículos',
    'nav.reservas': 'Reservas',
    'nav.maintenance': 'Manutenções',
    'nav.reports': 'Relatórios',
    'nav.history': 'Histórico',
    'nav.alerts': 'Alertas',
    'nav.companies': 'Empresas',
    'nav.more': 'Menu',
    'nav.new': 'Nova',
    'theme.light': 'Claro',
    'theme.dark': 'Escuro',
    'locale.label': 'Idioma',
    'tenant.company': 'Empresa',
    'tenant.all': 'Visão geral',
    'action.logout': 'Sair',
    'action.cancel': 'Cancelar',
    'action.close': 'Fechar',
    'notifications': 'Notificações',
  },
  'en-US': {
    'app.name': 'FrotaMaq',
    'greeting.welcome': 'Welcome back',
    'greeting.hello': 'Hello',
    'nav.home': 'Home',
    'nav.vehicles': 'Vehicles',
    'nav.reservas': 'Reservations',
    'nav.maintenance': 'Maintenance',
    'nav.reports': 'Reports',
    'nav.history': 'History',
    'nav.alerts': 'Alerts',
    'nav.companies': 'Companies',
    'nav.more': 'Menu',
    'nav.new': 'New',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'locale.label': 'Language',
    'tenant.company': 'Company',
    'tenant.all': 'Overview',
    'action.logout': 'Sign out',
    'action.cancel': 'Cancel',
    'action.close': 'Close',
    'notifications': 'Notifications',
  },
} as const

export type MessageKey = keyof typeof messages['pt-BR']

interface I18nContextType {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'pt-BR'
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en-US' ? 'en-US' : 'pt-BR'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale())

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next === 'en-US' ? 'en' : 'pt-BR'
  }, [])

  const t = useCallback((key: MessageKey) => messages[locale][key], [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
