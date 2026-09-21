import type { StatusVeiculo, TipoAlerta, StatusManutencao } from '@/types/database'
import { STATUS_VEICULO_LABELS, STATUS_VEICULO_COLORS, STATUS_MANUTENCAO_LABELS } from '@/types/database'

interface StatusBadgeProps {
  status: StatusVeiculo | StatusManutencao | TipoAlerta
  type?: 'veiculo' | 'manutencao' | 'alerta'
}

const ALERTA_LABELS: Record<TipoAlerta, string> = {
  vencida: 'Vencida',
  proxima: 'Próxima',
}

const ALERTA_COLORS: Record<TipoAlerta, string> = {
  vencida: 'bg-danger/10 text-danger',
  proxima: 'bg-warning/10 text-warning',
}

const MANUTENCAO_COLORS: Record<StatusManutencao, string> = {
  pendente: 'bg-blue-50 text-action',
  em_andamento: 'bg-warning/10 text-warning',
  concluida: 'bg-success/10 text-success',
  cancelada: 'bg-gray-100 text-gray-500',
}

export function StatusBadge({ status, type = 'veiculo' }: StatusBadgeProps) {
  let label: string
  let colorClass: string

  if (type === 'alerta') {
    label = ALERTA_LABELS[status as TipoAlerta]
    colorClass = ALERTA_COLORS[status as TipoAlerta]
  } else if (type === 'manutencao') {
    label = STATUS_MANUTENCAO_LABELS[status as StatusManutencao]
    colorClass = MANUTENCAO_COLORS[status as StatusManutencao]
  } else {
    label = STATUS_VEICULO_LABELS[status as StatusVeiculo]
    colorClass = STATUS_VEICULO_COLORS[status as StatusVeiculo]
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
