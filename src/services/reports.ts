import { container } from '@/infrastructure/di/container'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import type { TenantQueryOptions } from '@/lib/tenantFilter'
import type { Manutencao, TipoManutencao } from '@/types/database'

export interface ReportFilters extends TenantQueryOptions {
  period?: ReturnType<typeof PeriodoFinanceiro.mesAtual>
}

export interface CostByType {
  tipo: TipoManutencao
  total: number
}

export interface CostByVehicle {
  veiculo_id: string
  placa: string
  modelo: string
  total: number
}

export interface FinancialReportResult {
  totalGeral: number
  costByType: CostByType[]
  costByVehicle: CostByVehicle[]
  periodLabel: string
  recordCount: number
  usedFallbackPeriod: boolean
}

export interface MaintenanceDashboard {
  vencidas: Manutencao[]
  emManutencao: Manutencao[]
  proximas30: Manutencao[]
  concluidas: Manutencao[]
  statusCounts: { concluidas: number; proximas: number; vencidas: number }
  typeCounts: { preventiva: number; corretiva: number; preditiva: number }
}

export interface EmpresaSummary {
  empresa_id: string
  nome: string
  totalVeiculos: number
  veiculosAtivos: number
  emManutencao: number
  custoMes: number
}

/** Facade — relatórios e dashboards via casos de uso. */
export async function getFinancialReport(filters: ReportFilters = {}) {
  return container.getFinancialReport.execute({
    empresaId: filters.empresaId,
    period: filters.period,
  })
}

export async function getMaintenanceDashboard(options?: TenantQueryOptions) {
  return container.getMaintenanceDashboard.execute(options)
}

export async function getVeiculosEmManutencao(options?: TenantQueryOptions) {
  const { data, error } = await container.listVeiculos.execute({
    empresaId: options?.empresaId,
    status: 'em_manutencao',
  })
  return { data, error }
}

export async function getEmpresaSummaries() {
  return container.getEmpresaSummaries.execute()
}

export function getMonthRangeDates() {
  const p = PeriodoFinanceiro.mesAtual()
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    startDateTime: p.startDateTime,
    endDateTime: p.endDateTime,
    label: p.label,
  }
}

export function getLast30DaysRange() {
  const p = PeriodoFinanceiro.ultimos30Dias()
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    startDateTime: p.startDateTime,
    endDateTime: p.endDateTime,
    label: p.label,
  }
}
