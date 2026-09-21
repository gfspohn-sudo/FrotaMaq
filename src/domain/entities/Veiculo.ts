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
  anoModelo: number
  anoCarroceria: number | null
  kmAtual: number
  status: StatusVeiculo
  fotoUrl: string | null
  createdAt: string
  empresaNome?: string | null
}

/** Entidade de domínio — Veículo da frota. */
export class Veiculo {
  readonly id: string
  readonly empresaId: string | null
  readonly placa: string
  readonly modelo: string
  readonly marca: string
  readonly ano: number
  readonly anoModelo: number
  readonly anoCarroceria: number | null
  readonly kmAtual: Quilometragem
  readonly empresaNome: string | null
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
    this.anoModelo = props.anoModelo ?? props.ano
    this.anoCarroceria = props.anoCarroceria ?? null
    this.kmAtual = Quilometragem.from(props.kmAtual)
    this.empresaNome = props.empresaNome ?? null
    this.status = props.status
    this.fotoUrl = props.fotoUrl
    this.createdAt = props.createdAt
  }

  /** @deprecated Use nomeExibicao() com nome da empresa. */
  get descricaoCompleta(): string {
    return this.nomeExibicao(this.empresaNome ?? 'Frota')
  }

  /** Padrão: [Empresa] - [Placa Completa] */
  nomeExibicao(empresaNome: string): string {
    return `${empresaNome.trim()} - ${this.placa.trim().toUpperCase()}`
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
      anoModelo: this.anoModelo,
      anoCarroceria: this.anoCarroceria,
      kmAtual: overrides.kmAtual ?? this.kmAtual.value,
      empresaNome: this.empresaNome,
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
    const km = this.kmAtual.value
    return {
      id: this.id,
      empresa_id: this.empresaId,
      nome_exibicao: `${this.marca} ${this.modelo}`.trim(),
      placa: this.placa,
      marca: this.marca,
      modelo: this.modelo,
      ano: this.anoModelo,
      ano_modelo: this.anoModelo,
      ano_carroceria: this.anoCarroceria,
      quilometragem_atual: km,
      km_atual: km,
      status: this.status,
      created_at: this.createdAt,
    }
  }
}
