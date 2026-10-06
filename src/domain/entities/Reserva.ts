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
  kmInicial?: number | null
  kmFinal?: number | null
  kmPercorrido?: number | null
  dataFim?: string | null
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
  readonly kmInicial: number | null
  readonly kmFinal: number | null
  readonly kmPercorrido: number | null
  readonly dataFim: string | null
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
    this.kmInicial = props.kmInicial ?? null
    this.kmFinal = props.kmFinal ?? null
    this.kmPercorrido = props.kmPercorrido ?? null
    this.dataFim = props.dataFim ?? null
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

  estaConcluida(): boolean {
    return this.status === 'CONCLUIDA'
  }

  calcularKmPercorrido(kmFinal: number, kmInicial = this.kmInicial ?? 0): number {
    return kmFinal - kmInicial
  }

  validarKmFinal(kmFinal: number, kmInicial = this.kmInicial ?? 0): { ok: true } | { ok: false; message: string } {
    if (!Number.isFinite(kmFinal) || kmFinal < 0) {
      return { ok: false, message: 'Informe um km final válido.' }
    }
    if (kmFinal < kmInicial) {
      return { ok: false, message: 'O km final não pode ser menor que o km inicial.' }
    }
    return { ok: true }
  }

  podeSerAprovadaPor(usuario: Usuario): boolean {
    return usuario.podeAprovarReserva() && usuario.podeVisualizarEmpresa(this.empresaId)
  }

  podeSerFinalizadaPor(usuario: Usuario): boolean {
    if (this.status !== 'APROVADO') return false
    if (usuario.id === this.motoristaId) return true
    return usuario.podeAprovarReserva() && usuario.podeVisualizarEmpresa(this.empresaId)
  }

  podeSerVisualizadaPor(usuario: Usuario): boolean {
    if (usuario.podeAprovarReserva() && usuario.podeVisualizarEmpresa(this.empresaId)) return true
    return usuario.id === this.motoristaId
  }

  withStatus(status: StatusReserva, observacaoGestor?: string | null): Reserva {
    return this.clone({
      status,
      observacaoGestor: observacaoGestor ?? this.observacaoGestor,
      updatedAt: new Date().toISOString(),
    })
  }

  finalizar(kmFinal: number, kmInicial = this.kmInicial ?? 0): Reserva {
    const validation = this.validarKmFinal(kmFinal, kmInicial)
    if (!validation.ok) throw new Error(validation.message)
    return this.clone({
      kmInicial,
      kmFinal,
      kmPercorrido: kmFinal - kmInicial,
      dataFim: new Date().toISOString(),
      status: 'CONCLUIDA',
      updatedAt: new Date().toISOString(),
    })
  }

  private clone(overrides: Partial<ReservaProps>): Reserva {
    return new Reserva({
      id: this.id,
      empresaId: this.empresaId,
      veiculoId: this.veiculoId,
      motoristaId: this.motoristaId,
      dataViagem: this.dataViagem,
      destino: this.destino,
      kmIdaVolta: this.kmIdaVolta,
      kmInicial: this.kmInicial,
      kmFinal: this.kmFinal,
      kmPercorrido: this.kmPercorrido,
      dataFim: this.dataFim,
      status: this.status,
      observacaoGestor: this.observacaoGestor,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      veiculoPlaca: this.veiculoPlaca ?? undefined,
      veiculoModelo: this.veiculoModelo ?? undefined,
      motoristaNome: this.motoristaNome ?? undefined,
      ...overrides,
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
      km_inicial: this.kmInicial,
      km_final: this.kmFinal,
      km_percorrido: this.kmPercorrido,
      data_fim: this.dataFim,
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
