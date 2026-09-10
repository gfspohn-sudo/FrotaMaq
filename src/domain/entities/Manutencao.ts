import type { Manutencao as ManutencaoDTO } from '@/types/database'
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
  metodoPagamento: MetodoPagamento | null
  proximaManutencaoPrevisao: string | null
  proximaManutencaoData: string | null
  proximaManutencaoKm: number | null
  status: StatusManutencao
  createdAt: string
  veiculoResumo?: VeiculoResumoProps | null
}

const FINANCIAL_STATUSES = [
  'concluida',
  'em_andamento',
  'agendada',
  'realizada',
  'pendente',
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
  readonly metodoPagamento: MetodoPagamento | null
  readonly proximaManutencaoPrevisao: string | null
  readonly proximaManutencaoData: string | null
  readonly proximaManutencaoKm: number | null
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
    this.valor = Money.from(props.valor)
    this.metodoPagamento = props.metodoPagamento
    this.proximaManutencaoPrevisao = props.proximaManutencaoPrevisao
    this.proximaManutencaoData = props.proximaManutencaoData
    this.proximaManutencaoKm = props.proximaManutencaoKm
    this.status = props.status
    this.createdAt = props.createdAt
    this.veiculoResumo = props.veiculoResumo ?? null
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
    return {
      id: this.id,
      empresa_id: this.empresaId,
      veiculo_id: this.veiculoId,
      tipo: this.tipo,
      descricao: this.descricao,
      data_hora: this.dataHora,
      local: this.local,
      responsavel: this.responsavel,
      valor: this.valor.value,
      metodo_pagamento: this.metodoPagamento,
      proxima_manutencao_previsao: this.proximaManutencaoPrevisao,
      proxima_manutencao_data: this.proximaManutencaoData,
      proxima_manutencao_km: this.proximaManutencaoKm,
      status: this.status,
      created_at: this.createdAt,
      veiculos: this.veiculoResumo
        ? {
            placa: this.veiculoResumo.placa,
            modelo: this.veiculoResumo.modelo,
            marca: this.veiculoResumo.marca ?? '',
            km_atual: this.veiculoResumo.kmAtual ?? 0,
          }
        : undefined,
    }
  }
}
