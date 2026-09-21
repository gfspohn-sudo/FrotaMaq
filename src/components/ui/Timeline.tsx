import type { Manutencao } from '@/types/database'
import { TIPO_MANUTENCAO_LABELS, URGENCY_DOT } from '@/types/database'
import { getMaintenanceUrgency, formatCurrency, formatDate } from '@/lib/maintenanceStatus'
import {
  getManutencaoData,
  getManutencaoValor,
  normalizeTipoManutencao,
} from '@/lib/dbCompat'

interface TimelineProps {
  items: Manutencao[]
  veiculoKm?: number
  onItemClick?: (item: Manutencao) => void
  showFinancialDetails?: boolean
}

export function Timeline({ items, veiculoKm, onItemClick, showFinancialDetails = true }: TimelineProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">Nenhuma manutenção registrada.</p>
    )
  }

  return (
    <div className="relative space-y-0">
      {items.map((item, index) => {
        const kmRef = veiculoKm ?? item.veiculos?.quilometragem_atual ?? item.veiculos?.km_atual
        const urgency = getMaintenanceUrgency(item, kmRef)
        const tipo = normalizeTipoManutencao(item.tipo_normalizado ?? item.tipo)
        const dataRef = getManutencaoData(item)
        const valorRef = getManutencaoValor(item)

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className={`relative flex w-full gap-4 pb-6 text-left ${onItemClick ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {index < items.length - 1 && (
              <div className="absolute left-[7px] top-4 h-full w-0.5 bg-gray-200" />
            )}
            <div className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${URGENCY_DOT[urgency]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">{formatDate(dataRef)}</p>
              <p className="mt-0.5 font-medium text-gray-900">{item.descricao}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{TIPO_MANUTENCAO_LABELS[tipo]}</span>
                {item.local && (
                  <>
                    <span>·</span>
                    <span>{item.local}</span>
                  </>
                )}
                {item.responsavel && (
                  <>
                    <span>·</span>
                    <span>{item.responsavel}</span>
                  </>
                )}
                {showFinancialDetails && valorRef > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-medium text-gray-700">{formatCurrency(valorRef)}</span>
                  </>
                )}
              </div>
              {(item.data_proxima_manutencao ?? item.proxima_manutencao_data) && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Próxima: {formatDate(item.data_proxima_manutencao ?? item.proxima_manutencao_data!)}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
