import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Info,
  Leaf,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useNotifications } from '@/hooks/useNotifications'
import { usePermissions } from '@/hooks/usePermissions'
import { Spinner } from '@/components/ui/Spinner'
import type { NotificationItem, NotificationSeveridade, NotificationTipo } from '@/application/use-cases/GetNotificationsUseCase'

const ICON_BY_TYPE: Record<NotificationTipo, LucideIcon> = {
  alerta: AlertTriangle,
  preventiva: Wrench,
  reserva: CalendarClock,
  viagem_atraso: Truck,
  esg: Leaf,
}

const TONE_BY_SEVERITY: Record<NotificationSeveridade, string> = {
  critica: 'bg-danger/10 text-danger',
  alta: 'bg-warning/10 text-warning',
  media: 'bg-action/10 text-action',
  info: 'bg-surface-muted text-fg-muted',
}

function formatRelative(iso: string, now = Date.now()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = now - date.getTime()
  const minutes = Math.max(0, Math.round(Math.abs(diff) / 60_000))
  if (minutes < 1) return diff < 0 ? 'em instantes' : 'agora'
  if (minutes < 60) return diff < 0 ? `em ${minutes} min` : `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return diff < 0 ? `em ${hours} h` : `há ${hours} h`
  const days = Math.round(hours / 24)
  return diff < 0 ? `em ${days} d` : `há ${days} d`
}

export function NotificationBell() {
  const { t } = useI18n()
  const { canViewGlobalAlerts } = usePermissions()
  const { items, count, loading } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const badge = count > 99 ? '99+' : count > 9 ? '9+' : String(count)
  const label = `${t('notifications')}${count > 0 ? ` (${count})` : ''}`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="relative rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notifications')}
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-fg">Central de notificações</p>
              <p className="text-xs text-fg-muted">
                {count === 0 ? 'Nenhum alerta pendente' : `${count} alerta${count === 1 ? '' : 's'} pendente${count === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-fg-muted">
                <Spinner />
                Carregando alertas…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Info className="h-5 w-5 text-fg-subtle" />
                <p className="text-sm font-medium text-fg">Tudo em dia</p>
                <p className="text-xs text-fg-muted">Não há manutenções, viagens ou marcos ESG pendentes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map(item => (
                  <NotificationRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </div>

          {canViewGlobalAlerts && (
            <div className="border-t border-border bg-surface-muted/60 px-4 py-2">
              <Link
                to="/alertas"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-action hover:underline"
              >
                Ver todos os alertas
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: NotificationItem
  onNavigate: () => void
}) {
  const Icon = ICON_BY_TYPE[item.tipo] ?? Info
  return (
    <li>
      <Link
        to={item.href}
        onClick={onNavigate}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
      >
        <span className={`mt-0.5 rounded-lg p-2 ${TONE_BY_SEVERITY[item.severidade]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-fg">{item.titulo}</span>
            <span className="shrink-0 text-[11px] text-fg-subtle">{formatRelative(item.data)}</span>
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-fg-muted">{item.mensagem}</span>
        </span>
      </Link>
    </li>
  )
}
