import type { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { FinancialReportService } from '@/domain/services/FinancialReportService'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'

export interface EmpresaSummaryDTO {
  empresa_id: string
  nome: string
  totalVeiculos: number
  veiculosAtivos: number
  emManutencao: number
  custoMes: number
}

export class GetEmpresaSummariesUseCase {
  private readonly empresaRepo: IEmpresaRepository
  private readonly veiculoRepo: IVeiculoRepository
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(
    empresaRepo: IEmpresaRepository,
    veiculoRepo: IVeiculoRepository,
    manutencaoRepo: IManutencaoRepository,
  ) {
    this.empresaRepo = empresaRepo
    this.veiculoRepo = veiculoRepo
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(): Promise<{ data: EmpresaSummaryDTO[] | null; error: unknown }> {
    const [empresasRes, veiculosRes, custosRes] = await Promise.all([
      this.empresaRepo.findAll(),
      this.veiculoRepo.findAll(),
      this.manutencaoRepo.findWithFinancialValue(),
    ])

    if (empresasRes.error || !empresasRes.data) {
      return { data: null, error: empresasRes.error }
    }

    const periodo = PeriodoFinanceiro.mesAtual()
    const veiculos = veiculosRes.data ?? []
    const custos = FinancialReportService.filtrarPorPeriodo(custosRes.data ?? [], periodo)

    const summaries: EmpresaSummaryDTO[] = empresasRes.data.map(empresa => {
      const ev = veiculos.filter(v => v.empresaId === empresa.id)
      const custoMes = custos
        .filter(c => c.empresaId === empresa.id)
        .reduce((sum, c) => sum + c.valor.value, 0)

      return {
        empresa_id: empresa.id,
        nome: empresa.nome,
        totalVeiculos: ev.length,
        veiculosAtivos: ev.filter(v => v.estaEmOperacao()).length,
        emManutencao: ev.filter(v => v.estaEmManutencao()).length,
        custoMes,
      }
    })

    return { data: summaries, error: null }
  }
}
