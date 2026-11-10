import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

type KpiTone = 'neutral' | 'success' | 'action' | 'warning' | 'inactive' | 'danger'

const TONES: Record<KpiTone, { text: string; well: string }> = {
  neutral: { text: 'text-fg', well: 'bg-surface-muted' },
  success: { text: 'text-success', well: 'bg-success/10' },
  action: { text: 'text-action', well: 'bg-action/10' },
  warning: { text: 'text-warning', well: 'bg-warning/10' },
  inactive: { text: 'text-inactive', well: 'bg-inactive/10' },
  danger: { text: 'text-danger', well: 'bg-danger/10' },
}

interface KpiCardProps {
  label: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  tone?: KpiTone
  href?: string
}

export function KpiCard({ label, value, icon: Icon, tone = 'neutral', href }: KpiCardProps) {
  const styles = TONES[tone]
  const card = (
    <Card interactive={Boolean(href)} className="h-full">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${styles.well} ${styles.text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className={`text-2xl font-bold tracking-tight ${styles.text}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-fg-muted">{label}</p>
    </Card>
  )

  if (!href) return card

  return (
    <Link to={href} className="block h-full">
      {card}
    </Link>
  )
}
