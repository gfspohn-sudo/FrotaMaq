export interface PeriodoFinanceiroProps {
  startDate: string
  endDate: string
  startDateTime: string
  endDateTime: string
  label: string
}

/** Value Object — intervalo de datas para relatórios financeiros. */
export class PeriodoFinanceiro {
  readonly startDate: string
  readonly endDate: string
  readonly startDateTime: string
  readonly endDateTime: string
  readonly label: string

  private constructor(props: PeriodoFinanceiroProps) {
    this.startDate = props.startDate
    this.endDate = props.endDate
    this.startDateTime = props.startDateTime
    this.endDateTime = props.endDateTime
    this.label = props.label
  }

  private static pad2(n: number) {
    return String(n).padStart(2, '0')
  }

  static mesAtual(): PeriodoFinanceiro {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    return new PeriodoFinanceiro({
      startDate: `${year}-${PeriodoFinanceiro.pad2(month + 1)}-01`,
      endDate: `${year}-${PeriodoFinanceiro.pad2(month + 1)}-${PeriodoFinanceiro.pad2(lastDay)}`,
      startDateTime: new Date(year, month, 1, 0, 0, 0, 0).toISOString(),
      endDateTime: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
      label: `Custo total do mês (${monthName})`,
    })
  }

  static ultimos30Dias(): PeriodoFinanceiro {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date()
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)

    return new PeriodoFinanceiro({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      label: 'Custo total (últimos 30 dias)',
    })
  }

  static fromRange(range: Pick<PeriodoFinanceiroProps, 'startDateTime' | 'endDateTime'> & Partial<PeriodoFinanceiroProps>): PeriodoFinanceiro {
    return new PeriodoFinanceiro({
      startDate: range.startDate ?? range.startDateTime.slice(0, 10),
      endDate: range.endDate ?? range.endDateTime.slice(0, 10),
      startDateTime: range.startDateTime,
      endDateTime: range.endDateTime,
      label: range.label ?? '',
    })
  }

  contemTimestamp(value: string | null | undefined): boolean {
    if (!value) return false
    const ts = new Date(value).getTime()
    if (Number.isNaN(ts)) return false
    const start = new Date(this.startDateTime).getTime()
    const end = new Date(this.endDateTime).getTime()
    return ts >= start && ts <= end
  }
}
