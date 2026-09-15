import { Modal } from '@/components/ui/Modal'
import type { Manutencao } from '@/types/database'
import {
  TIPO_MANUTENCAO_LABELS,
  METODO_PAGAMENTO_LABELS,
  STATUS_MANUTENCAO_LABELS,
  URGENCY_LABELS,
  URGENCY_TEXT,
} from '@/types/database'
import {
  getMaintenanceUrgency,
  getVehicleName,
  formatCurrency,
  formatDateTime,
  formatDate,
} from '@/lib/maintenanceStatus'
import { parseMaintenanceValor } from '@/lib/financialUtils'

interface MaintenanceDetailModalProps {
  manutencao: Manutencao | null
  onClose: () => void
  veiculoKm?: number
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 sm:text-right">{value}</span>
    </div>
  )
}

export function MaintenanceDetailModal({ manutencao, onClose, veiculoKm }: MaintenanceDetailModalProps) {
  if (!manutencao) return null

  const urgency = getMaintenanceUrgency(manutencao, veiculoKm)

  return (
    <Modal isOpen={!!manutencao} onClose={onClose} title="Detalhes da Manutenção">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-sm font-medium text-gray-700">{manutencao.descricao}</span>
          <span className={`text-xs font-semibold ${URGENCY_TEXT[urgency]}`}>
            {URGENCY_LABELS[urgency]}
          </span>
        </div>

        <div className="space-y-3 divide-y divide-gray-100">
          <DetailRow label="Veículo" value={getVehicleName(manutencao)} />
          <DetailRow label="Tipo" value={TIPO_MANUTENCAO_LABELS[manutencao.tipo]} />
          <DetailRow label="Data da manutenção" value={formatDateTime(manutencao.data_hora)} />
          <DetailRow label="Status" value={STATUS_MANUTENCAO_LABELS[manutencao.status]} />
          <DetailRow
            label="Valor Total"
            value={formatCurrency(parseMaintenanceValor(manutencao.valor))}
          />
          <DetailRow label="Local / Oficina" value={manutencao.local || '—'} />
          <DetailRow
            label="Método de pagamento"
            value={
              manutencao.metodo_pagamento
                ? METODO_PAGAMENTO_LABELS[manutencao.metodo_pagamento]
                : '—'
            }
          />
          <DetailRow label="Responsável" value={manutencao.responsavel || '—'} />
          <DetailRow
            label="Próxima manutenção"
            value={manutencao.proxima_manutencao_previsao || '—'}
          />
          {manutencao.proxima_manutencao_data && (
            <DetailRow
              label="Data prevista"
              value={formatDate(manutencao.proxima_manutencao_data)}
            />
          )}
          {manutencao.proxima_manutencao_km != null && (
            <DetailRow
              label="Km previsto"
              value={`${manutencao.proxima_manutencao_km.toLocaleString('pt-BR')} km`}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
