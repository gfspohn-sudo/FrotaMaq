import { CalendarPlus, CircleCheck, History, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AUDIT_ACTION_LABELS, type AuditAction, type AuditLog } from '@/types/database'

const ACTION_STYLES: Record<AuditAction, { dot: string; icon: typeof Wrench; well: string }> = {
  viagem_criada: {
    dot: 'bg-action',
    well: 'bg-action/10 text-action',
    icon: CalendarPlus,
  },
  veiculo_em_manutencao: {
    dot: 'bg-warning',
    well: 'bg-warning/10 text-warning',
    icon: Wrench,
  },
  veiculo_liberado: {
    dot: 'bg-success',
    well: 'bg-success/10 text-success',
    icon: CircleCheck,
  },
}

function formatAuditTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(parsed)
}

interface AuditTimelineProps {
  events: AuditLog[]
  loading?: boolean
  title?: string
  emptyDescription?: string
}

export function AuditTimeline({
  events,
  loading = false,
  title = 'Histórico de auditoria',
  emptyDescription = 'As ações críticas deste registro aparecem aqui (viagem, manutenção e liberação).',
}: AuditTimelineProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-action" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>

      {loading ? (
        <Card className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum evento registrado"
          description={emptyDescription}
        />
      ) : (
        <Card>
          <ol className="relative space-y-0">
            {events.map((event, index) => {
              const style = ACTION_STYLES[event.acao]
              const Icon = style.icon
              return (
                <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < events.length - 1 && (
                    <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-border" />
                  )}
                  <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.well}`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${style.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-fg">
                      {AUDIT_ACTION_LABELS[event.acao]}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {formatAuditTimestamp(event.created_at)}
                      {event.usuario_nome ? ` · ${event.usuario_nome}` : ''}
                    </p>
                    {event.descricao && event.descricao !== AUDIT_ACTION_LABELS[event.acao] && (
                      <p className="mt-1 text-xs text-fg-subtle">{event.descricao}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      )}
    </section>
  )
}
