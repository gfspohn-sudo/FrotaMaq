import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { Money } from '@/domain/value-objects/Money'

export const FINANCIAL_REPORT_STATUSES = [
  'concluida',
  'em_andamento',
  'pendente',
  'realizada',
  'atrasada',
] as const

export type FinancialReportStatus = (typeof FINANCIAL_REPORT_STATUSES)[number]

export interface MonthRange {
  startDate: string
  endDate: string
  startDateTime: string
  endDateTime: string
  label: string
}

/** @deprecated Use PeriodoFinanceiro.mesAtual() */
export function getMonthRangeDates(): MonthRange {
  const p = PeriodoFinanceiro.mesAtual()
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    startDateTime: p.startDateTime,
    endDateTime: p.endDateTime,
    label: p.label,
  }
}

/** @deprecated Use PeriodoFinanceiro.ultimos30Dias() */
export function getLast30DaysRange(): MonthRange {
  const p = PeriodoFinanceiro.ultimos30Dias()
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    startDateTime: p.startDateTime,
    endDateTime: p.endDateTime,
    label: p.label,
  }
}

export function normalizeMaintenanceStatus(status: unknown): string {
  return String(status ?? '').trim().toLowerCase()
}

export function isFinancialMaintenanceStatus(status: unknown): boolean {
  const normalized = normalizeMaintenanceStatus(status)
  if (!normalized || normalized === 'cancelada') return false
  return (FINANCIAL_REPORT_STATUSES as readonly string[]).includes(normalized)
}

export function isTimestampInRange(
  value: string | null | undefined,
  range: Pick<MonthRange, 'startDateTime' | 'endDateTime'>,
): boolean {
  return PeriodoFinanceiro.fromRange(range).contemTimestamp(value)
}

export function isMaintenanceInPeriod(
  row: { data_hora?: string | null; data_manutencao?: string | null; created_at?: string | null },
  range: Pick<MonthRange, 'startDateTime' | 'endDateTime'>,
): boolean {
  const periodo = PeriodoFinanceiro.fromRange(range)
  const timestamp = row.data_manutencao ?? row.data_hora
  return periodo.contemTimestamp(timestamp) || periodo.contemTimestamp(row.created_at)
}

export function parseMaintenanceValor(value: unknown): number {
  return Money.from(value).value
}

export function hasFinancialValue(row: { valor?: unknown; valor_total?: unknown }): boolean {
  return Money.from(row.valor_total ?? row.valor).isPositive()
}

export function sumMaintenanceValues(rows: Array<{ valor?: unknown; valor_total?: unknown }>): number {
  return rows.reduce((sum, row) => sum + Money.from(row.valor_total ?? row.valor).value, 0)
}

const FINANCIAL_DEBUG = import.meta.env.DEV

export function logFinancialDebug(message: string, payload?: unknown) {
  if (!FINANCIAL_DEBUG) return
  if (payload !== undefined) console.log(`[FrotaLog/financeiro] ${message}`, payload)
  else console.log(`[FrotaLog/financeiro] ${message}`)
}
