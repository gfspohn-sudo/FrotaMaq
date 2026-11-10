import { formatPlacaCurta } from '@/lib/vehicleDisplay'

interface PlateBadgeProps {
  placa: string
  compact?: boolean
  className?: string
}

export function PlateBadge({ placa, compact = false, className = '' }: PlateBadgeProps) {
  const short = formatPlacaCurta(placa)

  return (
    <span
      title={placa}
      className={`inline-flex items-center rounded-md border border-zinc-400/50 bg-gradient-to-b from-zinc-100 to-zinc-300 px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.16em] text-zinc-900 shadow-sm dark:border-zinc-500/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 ${className}`}
    >
      {compact ? (
        <>
          <span className="mr-0.5 opacity-40">•••</span>
          {short}
        </>
      ) : (
        placa.trim().toUpperCase()
      )}
    </span>
  )
}
