import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bot, CircleCheck, Sparkles, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PlateBadge } from '@/components/ui/PlateBadge'
import { IaAssistantChat } from '@/components/IaAssistantChat'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getVeiculos } from '@/services/vehicles'
import { getManutencoes } from '@/services/maintenance'
import { getReservas } from '@/services/reservas'
import { loadOperationalFleet } from '@/lib/fleetSnapshotCache'
import {
  analyzeFleetTelemetry,
  analyzeVehicleTelemetry,
  buildVehicleTelemetry,
  type FleetIaInsight,
  type IaInsight,
  type NivelRiscoIa,
  type VehicleTelemetryInput,
} from '@/services/aiService'
import type { Manutencao, Veiculo } from '@/types/database'

const RISCO_STYLES: Record<NivelRiscoIa, { badge: string; border: string; icon: typeof CircleCheck; label: string }> = {
  baixo: {
    badge: 'bg-success/10 text-success',
    border: 'border-success/30',
    icon: CircleCheck,
    label: 'Risco baixo',
  },
  medio: {
    badge: 'bg-warning/10 text-warning',
    border: 'border-warning/40',
    icon: AlertTriangle,
    label: 'Risco médio',
  },
  alto: {
    badge: 'bg-danger/10 text-danger',
    border: 'border-danger/40',
    icon: AlertTriangle,
    label: 'Risco alto',
  },
}

interface IaInsightsCardProps {
  scope: 'dashboard' | 'veiculo'
  veiculo?: Veiculo | null
  manutencoes?: Manutencao[]
  onAgendarManutencao?: (veiculoId: string) => void
}

export function IaInsightsCard({
  scope,
  veiculo,
  manutencoes,
  onAgendarManutencao,
}: IaInsightsCardProps) {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const { canViewMaintenance, canCreateMaintenance } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vehicleInsight, setVehicleInsight] = useState<IaInsight | null>(null)
  const [fleetInsight, setFleetInsight] = useState<FleetIaInsight | null>(null)
  const [telemetries, setTelemetries] = useState<VehicleTelemetryInput[]>([])
  const hasContentRef = useRef(false)

  const load = useCallback(async () => {
    if (!canViewMaintenance) {
      setLoading(false)
      return
    }

    if (!hasContentRef.current) setLoading(true)
    setError('')

    try {
      const snapshot = await loadOperationalFleet({
        empresaId: filterEmpresaId,
        veiculos: getVeiculos({ empresaId: filterEmpresaId }, profile),
        reservas: getReservas(profile, { empresaId: filterEmpresaId }),
        manutencoes: getManutencoes({ empresaId: filterEmpresaId }, profile),
      })

      const veiculos = snapshot.veiculos
      const historico = snapshot.manutencoes
      const viagens = snapshot.reservas
      const frota = veiculos.map(item => buildVehicleTelemetry(item, historico, viagens))
      setTelemetries(frota)
      hasContentRef.current = true

      const localAviso = snapshot.source === 'live'
        ? ''
        : 'Servidor indisponível. Exibindo análise heurística com o último snapshot local da frota.'

      if (scope === 'veiculo') {
        if (!veiculo) {
          setVehicleInsight(null)
          return
        }
        const localManutencoes = historico.filter(item => item.veiculo_id === veiculo.id)
        const telemetry = buildVehicleTelemetry(
          veiculo,
          (manutencoes && manutencoes.length > 0 ? manutencoes : localManutencoes),
          viagens,
        )
        const insight = await analyzeVehicleTelemetry(telemetry)
        setVehicleInsight(localAviso ? { ...insight, aviso: insight.aviso ?? localAviso } : insight)
        setFleetInsight(null)
        return
      }

      const insight = await analyzeFleetTelemetry(frota)
      setFleetInsight(localAviso ? { ...insight, aviso: insight.aviso ?? localAviso } : insight)
      setVehicleInsight(null)
    } catch {
      setError('Não foi possível gerar o diagnóstico agora. Os dados da frota continuam disponíveis.')
      setVehicleInsight(null)
      setFleetInsight(null)
      if (!hasContentRef.current) setTelemetries([])
    } finally {
      setLoading(false)
    }
  }, [canViewMaintenance, filterEmpresaId, manutencoes, profile, scope, veiculo])

  useEffect(() => {
    hasContentRef.current = false
  }, [scope, veiculo?.id, filterEmpresaId])

  useEffect(() => {
    load()
  }, [load])

  useDataRefresh(load)

  if (!canViewMaintenance) return null

  const destaque = scope === 'veiculo' ? vehicleInsight : fleetInsight?.destaque
  const aviso = vehicleInsight?.aviso ?? fleetInsight?.aviso
  const outros = fleetInsight?.outros ?? []
  const welcome = destaque
    ? `Olá! Sou o assistente de **consulta operacional** (somente leitura). Destaque: **${destaque.placa}** — ${destaque.resumo}\n\nPergunte sobre disponibilidade, preventiva, viagens ou ESG.`
    : undefined

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-action" />
        <h2 className="text-base font-semibold text-fg">Co-Piloto de IA</h2>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Card className="border-warning/30 bg-warning/5">
          <p className="text-sm text-fg-muted">{error}</p>
          <IaAssistantChat
            telemetries={telemetries}
            focusPlaca={veiculo?.placa}
            storageKey={`${scope}:${filterEmpresaId ?? 'all'}:${veiculo?.id ?? 'frota'}`}
            ready
            welcome="Não consegui concluir o diagnóstico automático, mas você ainda pode perguntar sobre a frota."
          />
        </Card>
      ) : !destaque ? (
        <Card>
          <p className="py-2 text-center text-sm text-fg-muted">
            Nenhum veículo cadastrado para análise preditiva.
          </p>
          <IaAssistantChat
            telemetries={telemetries}
            focusPlaca={veiculo?.placa}
            storageKey={`${scope}:${filterEmpresaId ?? 'all'}:${veiculo?.id ?? 'frota'}`}
            ready
            welcome={welcome}
          />
        </Card>
      ) : (
        <InsightBody
          insight={destaque}
          aviso={aviso}
          outros={scope === 'dashboard' ? outros : []}
          canCreateMaintenance={canCreateMaintenance}
          onAgendarManutencao={onAgendarManutencao}
          telemetries={telemetries}
          focusPlaca={veiculo?.placa ?? destaque.placa}
          storageKey={`${scope}:${filterEmpresaId ?? 'all'}:${veiculo?.id ?? 'frota'}`}
          welcome={welcome}
        />
      )}
    </section>
  )
}

function LoadingState() {
  return (
    <Card className="border-action/20 bg-action/5">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </Card>
  )
}

function InsightBody({
  insight,
  aviso,
  outros,
  canCreateMaintenance,
  onAgendarManutencao,
  telemetries,
  focusPlaca,
  storageKey,
  welcome,
}: {
  insight: IaInsight
  aviso?: string
  outros: IaInsight[]
  canCreateMaintenance: boolean
  onAgendarManutencao?: (veiculoId: string) => void
  telemetries: VehicleTelemetryInput[]
  focusPlaca?: string
  storageKey: string
  welcome?: string
}) {
  const risco = RISCO_STYLES[insight.nivelRisco]
  const RiskIcon = risco.icon

  return (
    <Card className={risco.border}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${risco.badge}`}>
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PlateBadge placa={insight.placa} compact />
              <p className="text-sm font-medium text-fg">{insight.modelo}</p>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{insight.resumo}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${risco.badge}`}>
          <RiskIcon className="h-3.5 w-3.5" />
          {risco.label}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {insight.recomendacoes.map(item => (
          <li key={item} className="flex gap-2 text-sm text-fg">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-action" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {outros.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {outros.map(item => (
            <span
              key={item.veiculoId}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${RISCO_STYLES[item.nivelRisco].badge}`}
            >
              {item.placa} · {RISCO_STYLES[item.nivelRisco].label}
            </span>
          ))}
        </div>
      )}

      {aviso && (
        <p className="mt-3 text-xs text-fg-muted">{aviso}</p>
      )}

      {canCreateMaintenance && onAgendarManutencao && (
        <div className="mt-4">
          <Button onClick={() => onAgendarManutencao(insight.veiculoId)}>
            <Wrench className="h-4 w-4" />
            Agendar Manutenção
          </Button>
        </div>
      )}

      <IaAssistantChat
        telemetries={telemetries}
        focusPlaca={focusPlaca}
        storageKey={storageKey}
        ready
        welcome={welcome}
      />
    </Card>
  )
}
