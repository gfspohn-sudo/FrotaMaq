import type { Veiculo as VeiculoDTO } from '@/types/database'
import type { StatusVeiculo } from '@/domain/types/enums'
import { Quilometragem } from '@/domain/value-objects/Quilometragem'
import type { Usuario } from '@/domain/entities/usuario/Usuario'

export interface VeiculoProps {
  id: string
  empresaId: string | null
  placa: string
  modelo: string
  marca: string
  ano: number
  kmAtual: number
  status: StatusVeiculo
  fotoUrl: string | null
  createdAt: string
}

/** Entidade de domínio — Veículo da frota. */
export class Veiculo {
  readonly id: string
  readonly empresaId: string | null
  readonly placa: string
  readonly modelo: string
  readonly marca: string
  readonly ano: number
  readonly kmAtual: Quilometragem
  readonly status: StatusVeiculo
  readonly fotoUrl: string | null
  readonly createdAt: string

  constructor(props: VeiculoProps) {
    this.id = props.id
    this.empresaId = props.empresaId
    this.placa = props.placa
    this.modelo = props.modelo
    this.marca = props.marca
    this.ano = props.ano
    this.kmAtual = Quilometragem.from(props.kmAtual)
    this.status = props.status
    this.fotoUrl = props.fotoUrl
    this.createdAt = props.createdAt
  }

  get descricaoCompleta(): string {
    return `${this.modelo} - ${this.placa}`
  }

  estaEmOperacao(): boolean {
    return this.status === 'em_operacao'
  }

  estaEmManutencao(): boolean {
    return this.status === 'em_manutencao'
  }

  estaParado(): boolean {
    return this.status === 'fora_de_operacao'
  }

  validarNovaQuilometragem(km: number): { ok: true } | { ok: false; message: string } {
    const result = Quilometragem.create(km)
    if (!result.ok) return result
    if (result.value.value < this.kmAtual.value) {
      return { ok: false, message: 'A quilometragem não pode ser menor que a atual.' }
    }
    return { ok: true }
  }

  /** Retorna cópia do veículo com quilometragem atualizada; lança se inválida. */
  atualizarQuilometragem(km: number): Veiculo {
    const validation = this.validarNovaQuilometragem(km)
    if (!validation.ok) throw new Error(validation.message)
    return this.clone({ kmAtual: km })
  }

  /** Encaminha o veículo para manutenção (status `em_manutencao`). */
  encaminharParaManutencao(): Veiculo {
    if (this.status === 'em_manutencao') return this
    return this.clone({ status: 'em_manutencao' })
  }

  private clone(overrides: Partial<VeiculoProps>): Veiculo {
    return new Veiculo({
      id: this.id,
      empresaId: this.empresaId,
      placa: this.placa,
      modelo: this.modelo,
      marca: this.marca,
      ano: this.ano,
      kmAtual: overrides.kmAtual ?? this.kmAtual.value,
      status: overrides.status ?? this.status,
      fotoUrl: this.fotoUrl,
      createdAt: this.createdAt,
    })
  }

  podeSerEditadoPor(usuario: Usuario): boolean {
    return usuario.podeGerenciarVeiculos() && this.pertenceAoEscopo(usuario)
  }

  podeAtualizarMedicaoPor(usuario: Usuario): boolean {
    return usuario.podeAtualizarKm() && this.pertenceAoEscopo(usuario)
  }

  pertenceAoEscopo(usuario: Usuario): boolean {
    if (!this.empresaId) return usuario.podeVisualizarEmpresa('')
    return usuario.podeVisualizarEmpresa(this.empresaId)
  }

  toDTO(): VeiculoDTO {
    return {
      id: this.id,
      empresa_id: this.empresaId,
      placa: this.placa,
      modelo: this.modelo,
      marca: this.marca,
      ano: this.ano,
      km_atual: this.kmAtual.value,
      status: this.status,
      foto_url: this.fotoUrl,
      created_at: this.createdAt,
    }
  }
}
