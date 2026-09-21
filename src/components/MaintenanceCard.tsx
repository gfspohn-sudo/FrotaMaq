import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Manutencao } from '@/types/database'
import { TIPO_MANUTENCAO_LABELS, URGENCY_BORDER, URGENCY_BG, METODO_PAGAMENTO_LABELS } from '@/types/database'
import { parseMaintenanceValor } from '@/lib/financialUtils'
import {
  getMaintenanceUrgency,
  getVehicleName,
  formatCurrency,
  formatDate,
} from '@/lib/maintenanceStatus'
import {
  getManutencaoData,
  getManutencaoFormaPagamento,
  getManutencaoLocal,
  getManutencaoProximaData,
  getManutencaoStatus,
  getManutencaoValor,
  normalizeTipoManutencao,
} from '@/lib/dbCompat'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'

interface MaintenanceCardProps {
  manutencao: Manutencao
  veiculoKm?: number
  showVehicle?: boolean
  onClick?: () => void
  actions?: React.ReactNode
  showFinancialDetails?: boolean
}

function formatFormaPagamento(m: Manutencao): string | null {
  const raw = getManutencaoFormaPagamento(m)
  if (!raw) return null
  const normalized = ManutencaoMapper.normalizeFormaPagamento(raw)
  if (normalized) return METODO_PAGAMENTO_LABELS[normalized]
  return raw
}

export function MaintenanceCard({
  manutencao,
  veiculoKm,
  showVehicle = true,
  onClick,
  actions,
  showFinancialDetails = true,
}: MaintenanceCardProps) {
  const tipo = normalizeTipoManutencao(manutencao.tipo_normalizado ?? manutencao.tipo)
  const dataRef = getManutencaoData(manutencao)
  const valorRef = getManutencaoValor(manutencao)
  const status = getManutencaoStatus(manutencao)
  const local = getManutencaoLocal(manutencao)
  const responsavel = manutencao.responsavel
  const formaPagamento = formatFormaPagamento(manutencao)
  const proximaData = getManutencaoProximaData(manutencao)

  const urgency = getMaintenanceUrgency(
    manutencao,
    veiculoKm ?? manutencao.veiculos?.quilometragem_atual ?? manutencao.veiculos?.km_atual,
  )

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
            <span>{TIPO_MANUTENCAO_LABELS[tipo]}</span>
            <span>·</span>
            <span>{formatDate(dataRef)}</span>
            {local && (
              <>
                <span>·</span>
                <span>{local}</span>
              </>
            )}
            {responsavel && (
              <>
                <span>·</span>
                <span>{responsavel}</span>
              </>
            )}
            {formaPagamento && (
              <>
                <span>·</span>
                <span>{formaPagamento}</span>
              </>
            )}
            {showFinancialDetails && parseMaintenanceValor(valorRef) > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-gray-700">
                  {formatCurrency(parseMaintenanceValor(valorRef))}
                </span>
              </>
            )}
          </div>
          {proximaData && (
            <p className="mt-1 text-xs text-gray-400">
              Próxima: {formatDate(proximaData)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={status} type="manutencao" />
          {onClick && <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {actions && <div className="mt-3" onClick={e => e.stopPropagation()}>{actions}</div>}
    </Card>
  )
}
