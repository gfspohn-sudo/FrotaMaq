import type { Manutencao as ManutencaoDTO, PecaTrocada } from '@/types/database'
import type {
  StatusManutencao,
  TipoManutencao,
  MetodoPagamento,
  MaintenanceUrgency,
} from '@/domain/types/enums'
import { Money } from '@/domain/value-objects/Money'
import { MaintenanceUrgencyService } from '@/domain/services/MaintenanceUrgencyService'
import type { Usuario } from '@/domain/entities/usuario/Usuario'

export interface VeiculoResumoProps {
  placa: string
  modelo: string
  marca?: string
  kmAtual?: number
}

export interface ManutencaoProps {
  id: string
  empresaId: string | null
  veiculoId: string
  tipo: TipoManutencao
  descricao: string
  dataHora: string
  local: string | null
  responsavel: string | null
  valor: unknown
  metodoPagamento: MetodoPagamento | string | null
  proximaManutencaoData: string | null
  proximaManutencaoKm?: number | null
  kmAtualVeiculo?: number | null
  pecasTrocadas?: PecaTrocada[]
  valorMaoDeObra?: number
  valorPecas?: number
  observacao?: string | null
  status: StatusManutencao
  createdAt: string
  veiculoResumo?: VeiculoResumoProps | null
}

const FINANCIAL_STATUSES = [
  'concluida',
  'em_andamento',
  'pendente',
  'realizada',
  'atrasada',
] as const

/** Entidade de domínio — Manutenção. */
export class Manutencao {
  readonly id: string
  readonly empresaId: string | null
  readonly veiculoId: string
  readonly tipo: TipoManutencao
  readonly descricao: string
  readonly dataHora: string
  readonly local: string | null
  readonly responsavel: string | null
  readonly valor: Money
  readonly metodoPagamento: MetodoPagamento | string | null
  readonly proximaManutencaoData: string | null
  readonly proximaManutencaoKm: number | null
  readonly kmAtualVeiculo: number | null
  readonly pecasTrocadas: PecaTrocada[]
  readonly valorMaoDeObra: Money
  readonly valorPecas: Money
  readonly observacao: string | null
  readonly status: StatusManutencao
  readonly createdAt: string
  readonly veiculoResumo: VeiculoResumoProps | null

  constructor(props: ManutencaoProps) {
    this.id = props.id
    this.empresaId = props.empresaId
    this.veiculoId = props.veiculoId
    this.tipo = props.tipo
    this.descricao = props.descricao
    this.dataHora = props.dataHora
    this.local = props.local
    this.responsavel = props.responsavel
    this.metodoPagamento = props.metodoPagamento
    this.proximaManutencaoData = props.proximaManutencaoData
    this.proximaManutencaoKm = props.proximaManutencaoKm ?? null
    this.kmAtualVeiculo = props.kmAtualVeiculo ?? null
    this.pecasTrocadas = props.pecasTrocadas ?? []
    this.valorMaoDeObra = Money.from(props.valorMaoDeObra ?? 0)
    this.valorPecas = Money.from(props.valorPecas ?? 0)
    this.observacao = props.observacao ?? null
    this.status = props.status
    this.createdAt = props.createdAt
    this.veiculoResumo = props.veiculoResumo ?? null

    const totalInformado = Money.from(props.valor)
    const totalDiscriminado = this.valorMaoDeObra.add(this.valorPecas)
    this.valor = totalDiscriminado.isPositive() ? totalDiscriminado : totalInformado
  }

  get nomeVeiculo(): string {
    if (this.veiculoResumo) {
      return `${this.veiculoResumo.modelo} - ${this.veiculoResumo.placa}`
    }
    return 'Veículo'
  }

  calcularUrgencia(veiculoKm?: number): MaintenanceUrgency {
    return MaintenanceUrgencyService.calcular(this, veiculoKm ?? this.veiculoResumo?.kmAtual)
  }

  possuiValorFinanceiro(): boolean {
    return this.valor.isPositive()
  }

  /** Valor Total da manutenção (mão de obra + peças). */
  calcularValorTotal(): Money {
    return this.valor
  }

  isTrocaDeOleo(): boolean {
    const texto = `${this.descricao} ${this.observacao ?? ''}`.toLowerCase()
    return /oleo|óleo|lubrific/.test(texto)
  }

  entraEmRelatorioFinanceiro(): boolean {
    const normalized = String(this.status).trim().toLowerCase()
    if (!normalized || normalized === 'cancelada') return false
    return (FINANCIAL_STATUSES as readonly string[]).includes(normalized)
  }

  estaNoPeriodo(dataHora: string, createdAt: string, periodo: { contemTimestamp(v: string | null | undefined): boolean }): boolean {
    return periodo.contemTimestamp(dataHora) || periodo.contemTimestamp(createdAt)
  }

  podeSerRegistradaPor(usuario: Usuario): boolean {
    return usuario.podeRegistrarManutencao() && this.pertenceAoEscopo(usuario)
  }

  podeSerConcluidaPor(usuario: Usuario): boolean {
    return usuario.podeConcluirManutencao() && this.pertenceAoEscopo(usuario)
  }

  pertenceAoEscopo(usuario: Usuario): boolean {
    if (!this.empresaId) return usuario.podeVisualizarEmpresa('')
    return usuario.podeVisualizarEmpresa(this.empresaId)
  }

  toDTO(): ManutencaoDTO {
    const formaPagamento = typeof this.metodoPagamento === 'string'
      ? this.metodoPagamento
      : this.metodoPagamento ?? null

    return {
      id: this.id,
      empresa_id: this.empresaId,
      veiculo_id: this.veiculoId,
      descricao: this.descricao,
      valor_total: this.valor.value,
      valor_mao_de_obra: this.valorMaoDeObra.value,
      valor_pecas: this.valorPecas.value,
      pecas_trocadas: this.pecasTrocadas,
      km_atual_veiculo: this.kmAtualVeiculo,
      observacao: this.observacao,
      data_manutencao: this.dataHora,
      data_proxima_manutencao: this.proximaManutencaoData,
      proxima_manutencao_km: this.proximaManutencaoKm,
      tipo: this.tipo.toUpperCase(),
      status: this.status,
      forma_pagamento: formaPagamento,
      local_manutencao: this.local,
      responsavel: this.responsavel,
      created_at: this.createdAt,
      tipo_normalizado: this.tipo,
      data_hora: this.dataHora,
      valor: this.valor.value,
      local: this.local,
      metodo_pagamento: typeof this.metodoPagamento === 'string'
        ? null
        : this.metodoPagamento,
      proxima_manutencao_data: this.proximaManutencaoData,
      veiculos: this.veiculoResumo
        ? {
            placa: this.veiculoResumo.placa,
            nome_exibicao: `${this.veiculoResumo.marca ?? ''} ${this.veiculoResumo.modelo}`.trim(),
            modelo: this.veiculoResumo.modelo,
            marca: this.veiculoResumo.marca ?? '',
            quilometragem_atual: this.veiculoResumo.kmAtual ?? 0,
            km_atual: this.veiculoResumo.kmAtual ?? 0,
          }
        : undefined,
    }
  }
}
