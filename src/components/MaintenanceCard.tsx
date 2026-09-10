import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Manutencao } from '@/types/database'
import { TIPO_MANUTENCAO_LABELS, URGENCY_BORDER, URGENCY_BG } from '@/types/database'
import { parseMaintenanceValor } from '@/lib/financialUtils'
import {
  getMaintenanceUrgency,
  getVehicleName,
  formatCurrency,
  formatDate,
} from '@/lib/maintenanceStatus'

interface MaintenanceCardProps {
  manutencao: Manutencao
  veiculoKm?: number
  showVehicle?: boolean
  onClick?: () => void
  actions?: React.ReactNode
}

export function MaintenanceCard({
  manutencao,
  veiculoKm,
  showVehicle = true,
  onClick,
  actions,
}: MaintenanceCardProps) {
  const urgency = getMaintenanceUrgency(manutencao, veiculoKm ?? manutencao.veiculos?.km_atual)

  return (
    <Card
      className={`${URGENCY_BORDER[urgency]} ${URGENCY_BG[urgency]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">{manutencao.descricao}</p>
          {showVehicle && (
            <p className="text-sm text-gray-500">{getVehicleName(manutencao)}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>{TIPO_MANUTENCAO_LABELS[manutencao.tipo]}</span>
            <span>·</span>
            <span>{formatDate(manutencao.data_hora)}</span>
            {manutencao.local && (
              <>
                <span>·</span>
                <span>{manutencao.local}</span>
              </>
            )}
            {parseMaintenanceValor(manutencao.valor) > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-gray-700">
                  {formatCurrency(parseMaintenanceValor(manutencao.valor))}
                </span>
              </>
            )}
          </div>
          {manutencao.proxima_manutencao_previsao && (
            <p className="mt-1 text-xs text-gray-400">
              Próxima: {manutencao.proxima_manutencao_previsao}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={manutencao.status} type="manutencao" />
          {onClick && <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {actions && <div className="mt-3" onClick={e => e.stopPropagation()}>{actions}</div>}
    </Card>
  )
}
