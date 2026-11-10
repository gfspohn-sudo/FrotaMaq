import { NavLink } from 'react-router-dom'
import { ALL_EMPRESAS, ALL_EMPRESAS_LABEL } from '@/lib/tenantFilter'
import { getInitials } from '@/lib/uiHelpers'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/contexts/I18nContext'
import { useTenant } from '@/contexts/TenantContext'
import { useNavItems } from '@/hooks/useNavItems'

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { profile } = useAuth()
  const { t } = useI18n()
  const items = useNavItems()
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    isSuperAdminUser,
    isViewingAll,
    loadingEmpresas,
  } = useTenant()

  const tenantName = isViewingAll
    ? t('tenant.all')
    : empresas.find(e => e.id === selectedEmpresaId)?.nome ?? t('app.name')

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-surface/90 backdrop-blur-xl">
      <div className="border-b border-border px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">{t('app.name')}</p>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-muted/70 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-action/15 text-xs font-semibold text-action">
            {getInitials(tenantName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{tenantName}</p>
            <p className="text-[11px] text-fg-muted">{t('tenant.company')}</p>
          </div>
        </div>
        {isSuperAdminUser && (
          <select
            value={selectedEmpresaId}
            onChange={e => setSelectedEmpresaId(e.target.value)}
            disabled={loadingEmpresas}
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20"
          >
            <option value={ALL_EMPRESAS}>{ALL_EMPRESAS_LABEL}</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-action/10 text-action shadow-sm'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-sm font-medium text-fg">{profile?.nome ?? 'Usuário'}</p>
        <p className="truncate text-xs text-fg-muted">{profile?.email}</p>
      </div>
    </aside>
  )
}
