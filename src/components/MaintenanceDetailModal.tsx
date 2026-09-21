import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
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
import {
  getManutencaoData,
  getManutencaoFormaPagamento,
  getManutencaoLocal,
  getManutencaoProximaData,
  getManutencaoStatus,
  getManutencaoValor,
  isManutencaoAtiva,
  normalizeTipoManutencao,
} from '@/lib/dbCompat'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'

interface MaintenanceDetailModalProps {
  manutencao: Manutencao | null
  onClose: () => void
  veiculoKm?: number
  canConcluir?: boolean
  onConcluir?: (id: string) => Promise<void>
  concluindo?: boolean
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 sm:text-right">{value}</span>
    </div>
  )
}

function formatFormaPagamento(m: Manutencao): string {
  const raw = getManutencaoFormaPagamento(m)
  if (!raw) return '—'
  const normalized = ManutencaoMapper.normalizeFormaPagamento(raw)
  if (normalized) return METODO_PAGAMENTO_LABELS[normalized]
  return raw
}

export function MaintenanceDetailModal({
  manutencao,
  onClose,
  veiculoKm,
  canConcluir = false,
  onConcluir,
  concluindo = false,
}: MaintenanceDetailModalProps) {
  if (!manutencao) return null

  const urgency = getMaintenanceUrgency(manutencao, veiculoKm)
  const tipo = normalizeTipoManutencao(manutencao.tipo_normalizado ?? manutencao.tipo)
  const dataRef = getManutencaoData(manutencao)
  const valorRef = getManutencaoValor(manutencao)
  const status = getManutencaoStatus(manutencao)
  const proximaData = getManutencaoProximaData(manutencao)
  const showConcluir = canConcluir && onConcluir && isManutencaoAtiva(status) && !manutencao.id.startsWith('veiculo-em-manutencao-')

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
          <DetailRow label="Tipo" value={TIPO_MANUTENCAO_LABELS[tipo]} />
          <DetailRow label="Data da manutenção" value={formatDateTime(dataRef)} />
          <DetailRow label="Status" value={STATUS_MANUTENCAO_LABELS[status]} />
          <DetailRow
            label="Valor Total"
            value={formatCurrency(parseMaintenanceValor(valorRef))}
          />
          <DetailRow label="Local / Oficina" value={getManutencaoLocal(manutencao) || '—'} />
          <DetailRow label="Forma de pagamento" value={formatFormaPagamento(manutencao)} />
          <DetailRow label="Responsável" value={manutencao.responsavel || '—'} />
          <DetailRow
            label="Data da próxima manutenção"
            value={proximaData ? formatDate(proximaData) : '—'}
          />
        </div>

        {showConcluir && (
          <Button
            className="w-full"
            onClick={() => onConcluir!(manutencao.id)}
            disabled={concluindo}
          >
            {concluindo ? 'Concluindo...' : 'Concluir Manutenção'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
