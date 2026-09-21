import { container } from '@/infrastructure/di/container'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { TenantQueryOptions } from '@/lib/tenantFilter'
import type { Manutencao, TipoManutencao, Usuario } from '@/types/database'

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
export async function getFinancialReport(filters: ReportFilters = {}, profile?: Usuario | null) {
  const usuario = UsuarioFactory.fromProfile(profile)
  if (!usuario.podeVisualizarMetricasFinanceirasGlobais()) {
    return { data: null, error: new Error('Sem permissão para visualizar relatório financeiro.') }
  }

  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, filters)
  if (scopeError) return { data: null, error: scopeError }

  return container.getFinancialReport.execute({
    empresaId: scoped.empresaId,
    period: filters.period,
  })
}

export async function getMaintenanceDashboard(options?: TenantQueryOptions, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { data: null, error: scopeError }

  return container.getMaintenanceDashboard.execute(scoped)
}

export async function getVeiculosEmManutencao(options?: TenantQueryOptions, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { data: null, error: scopeError }

  const { data, error } = await container.listVeiculos.execute({
    empresaId: scoped.empresaId,
    status: 'em_manutencao',
  })
  const filtered = data ? TenantScopeService.filterRecordsByTenant(profile, data) : null
  return { data: filtered, error }
}

export async function getEmpresaSummaries(profile?: Usuario | null) {
  if (profile && profile.perfil !== 'super_admin') {
    return { data: null, error: new Error('Sem permissão para visão global de empresas.') }
  }
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
