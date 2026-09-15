import type { Reserva as ReservaDTO } from '@/types/database'
import type { StatusReserva } from '@/domain/types/reserva'
import type { Usuario } from '@/domain/entities/usuario/Usuario'

export interface ReservaProps {
  id: string
  empresaId: string
  veiculoId: string
  motoristaId: string
  dataViagem: string
  destino: string
  kmIdaVolta: number
  status: StatusReserva
  observacaoGestor: string | null
  createdAt: string
  updatedAt: string
  veiculoPlaca?: string
  veiculoModelo?: string
  motoristaNome?: string
}

/** Entidade de domínio — Reserva de veículo. */
export class Reserva {
  readonly id: string
  readonly empresaId: string
  readonly veiculoId: string
  readonly motoristaId: string
  readonly dataViagem: string
  readonly destino: string
  readonly kmIdaVolta: number
  readonly status: StatusReserva
  readonly observacaoGestor: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly veiculoPlaca: string | null
  readonly veiculoModelo: string | null
  readonly motoristaNome: string | null

  constructor(props: ReservaProps) {
    this.id = props.id
    this.empresaId = props.empresaId
    this.veiculoId = props.veiculoId
    this.motoristaId = props.motoristaId
    this.dataViagem = props.dataViagem
    this.destino = props.destino
    this.kmIdaVolta = props.kmIdaVolta
    this.status = props.status
    this.observacaoGestor = props.observacaoGestor
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
    this.veiculoPlaca = props.veiculoPlaca ?? null
    this.veiculoModelo = props.veiculoModelo ?? null
    this.motoristaNome = props.motoristaNome ?? null
  }

  estaPendente(): boolean {
    return this.status === 'PENDENTE'
  }

  estaAprovada(): boolean {
    return this.status === 'APROVADO'
  }

  podeSerAprovadaPor(usuario: Usuario): boolean {
    return usuario.podeAprovarReserva() && usuario.podeVisualizarEmpresa(this.empresaId)
  }

  podeSerVisualizadaPor(usuario: Usuario): boolean {
    if (usuario.podeAprovarReserva() && usuario.podeVisualizarEmpresa(this.empresaId)) return true
    return usuario.id === this.motoristaId
  }

  withStatus(status: StatusReserva, observacaoGestor?: string | null): Reserva {
    return new Reserva({
      id: this.id,
      empresaId: this.empresaId,
      veiculoId: this.veiculoId,
      motoristaId: this.motoristaId,
      dataViagem: this.dataViagem,
      destino: this.destino,
      kmIdaVolta: this.kmIdaVolta,
      status,
      observacaoGestor: observacaoGestor ?? this.observacaoGestor,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      veiculoPlaca: this.veiculoPlaca ?? undefined,
      veiculoModelo: this.veiculoModelo ?? undefined,
      motoristaNome: this.motoristaNome ?? undefined,
    })
  }

  toDTO(): ReservaDTO {
    return {
      id: this.id,
      empresa_id: this.empresaId,
      veiculo_id: this.veiculoId,
      motorista_id: this.motoristaId,
      data_viagem: this.dataViagem,
      destino: this.destino,
      km_ida_volta: this.kmIdaVolta,
      status: this.status,
      observacao_gestor: this.observacaoGestor,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      veiculos: this.veiculoPlaca
        ? { placa: this.veiculoPlaca, modelo: this.veiculoModelo ?? '' }
        : undefined,
      usuarios: this.motoristaNome ? { nome: this.motoristaNome } : undefined,
    }
  }
}
