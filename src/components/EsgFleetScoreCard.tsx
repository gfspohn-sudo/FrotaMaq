import type { EsgFleetScore } from '@/utils/esgFleetScore'

const TONE_STYLES = {
  excelente: {
    ring: 'stroke-emerald-500',
    badge: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300',
    bar: 'bg-emerald-600',
  },
  atencao: {
    ring: 'stroke-amber-500',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  critico: {
    ring: 'stroke-rose-500',
    badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
} as const

interface EsgFleetScoreCardProps {
  score: EsgFleetScore
}

export function EsgFleetScoreCard({ score }: EsgFleetScoreCardProps) {
  const tone = TONE_STYLES[score.tom]
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score.nota / 100) * circumference

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 72 72" className="-rotate-90 h-24 w-24">
            <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-muted" />
            <circle
              cx="36"
              cy="36"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={tone.ring}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-fg">{score.nota.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-action">
            Índice FrotaMaq ESG & Eficiência
          </p>
          <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>
            {score.classificacao}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, score.nota)}%` }} />
          </div>
          <dl className="mt-3 grid gap-2 text-[11px] text-fg-muted sm:grid-cols-3">
            <div>
              <dt>Preventiva em dia</dt>
              <dd className="font-semibold text-fg">
                {score.preventivaEmDiaPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                <span className="ml-1 font-normal text-fg-muted">
                  ({score.veiculosEmDia}/{score.totalVeiculos})
                </span>
              </dd>
            </div>
            <div>
              <dt>Preventiva vs. corretiva</dt>
              <dd className="font-semibold text-fg">
                {score.preventivaVsCorretivaPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
              </dd>
            </div>
            <div>
              <dt>Emissão / km</dt>
              <dd className="font-semibold text-fg">
                {score.kgCo2PorKm == null
                  ? 'sem KM no mês'
                  : `${score.kgCo2PorKm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
