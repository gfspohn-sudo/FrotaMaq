import type { NovoVeiculo, StatusVeiculo, Veiculo as VeiculoDTO } from '@/types/database'
import { Veiculo } from '@/domain/entities/Veiculo'

type VeiculoRow = VeiculoDTO & {
  nome_exibicao?: string | null
  quilometragem_atual?: number | null
  intervalo_manutencao_km?: number | null
  intervalo_manutencao_dias?: number | null
}

export class VeiculoMapper {
  private static parseMarcaModelo(row: VeiculoRow): { marca: string; modelo: string } {
    if (row.marca && row.modelo) {
      return { marca: row.marca, modelo: row.modelo }
    }

    const nome = row.nome_exibicao?.trim() ?? ''
    if (!nome) return { marca: '—', modelo: '—' }

    const parts = nome.split(/\s+/)
    if (parts.length === 1) return { marca: parts[0], modelo: '—' }

    return { marca: parts[0], modelo: parts.slice(1).join(' ') }
  }

  static mapStatusToDb(status: StatusVeiculo): string {
    switch (status) {
      case 'em_manutencao':
        return 'EM_MANUTENCAO'
      case 'em_viagem':
        return 'EM_VIAGEM'
      case 'parado':
        return 'PARADO'
      case 'disponivel':
      default:
        return 'DISPONIVEL'
    }
  }

  /** Valores possíveis no banco para filtrar por status da aplicação. */
  static statusDbValuesForFilter(status: StatusVeiculo): string[] {
    switch (status) {
      case 'em_manutencao':
        return ['EM_MANUTENCAO', 'em_manutencao', 'MANUTENCAO', 'Manutenção', 'Em manutenção']
      case 'em_viagem':
        return ['EM_VIAGEM', 'em_viagem']
      case 'parado':
        return ['PARADO', 'parado', 'INATIVO', 'inativo', 'FORA_DE_OPERACAO', 'fora_de_operacao']
      case 'disponivel':
      default:
        return ['DISPONIVEL', 'disponivel', 'ATIVO', 'ativo', 'EM_OPERACAO', 'em_operacao']
    }
  }

  /** Normaliza qualquer valor de `veiculos.status` para o enum da aplicação. */
  static normalizeStatusFromDb(status: string | undefined | null): StatusVeiculo {
    const raw = (status ?? '').trim()
    if (!raw) return 'disponivel'

    const canonical = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
    if (['ativo', 'em_operacao', 'disponivel', 'operacao'].includes(canonical)) {
      return 'disponivel'
    }
    if (['em_viagem'].includes(canonical)) {
      return 'em_viagem'
    }
    if (['em_manutencao', 'manutencao'].includes(canonical)) {
      return 'em_manutencao'
    }
    if (['inativo', 'fora_de_operacao', 'parado'].includes(canonical)) {
      return 'parado'
    }

    if (raw === 'em_manutencao' || raw === 'disponivel' || raw === 'em_viagem' || raw === 'parado') {
      return raw
    }

    return 'disponivel'
  }

  private static mapStatusFromDb(status: string | undefined): StatusVeiculo {
    return VeiculoMapper.normalizeStatusFromDb(status)
  }

  /** Converte payload de domínio para colunas atuais da tabela `veiculos`. */
  static toDbPayload(input: NovoVeiculo): Record<string, unknown> {
    const anoModelo = input.ano_modelo ?? input.ano ?? null
    return {
      empresa_id: input.empresa_id,
      nome_exibicao: `${input.marca} ${input.modelo}`.trim(),
      placa: input.placa.trim().toUpperCase(),
      ano: anoModelo,
      ano_modelo: anoModelo,
      ano_carroceria: input.ano_carroceria ?? null,
      quilometragem_atual: input.km_atual ?? 0,
      km_atual: input.km_atual ?? 0,
      intervalo_manutencao_km: input.intervalo_manutencao_km ?? 10000,
      intervalo_manutencao_dias: input.intervalo_manutencao_dias ?? 180,
      status: VeiculoMapper.mapStatusToDb(input.status ?? 'disponivel'),
    }
  }

  static toDbUpdate(input: Partial<NovoVeiculo>): Record<string, unknown> {
    const payload: Record<string, unknown> = {}

    if (input.placa != null) payload.placa = input.placa.trim().toUpperCase()
    if (input.km_atual != null) {
      payload.quilometragem_atual = input.km_atual
      payload.km_atual = input.km_atual
    }
    if (input.ano_modelo != null || input.ano != null) {
      const anoModelo = input.ano_modelo ?? input.ano ?? null
      payload.ano = anoModelo
      payload.ano_modelo = anoModelo
    }
    if (input.ano_carroceria !== undefined) payload.ano_carroceria = input.ano_carroceria
    if (input.status != null) payload.status = VeiculoMapper.mapStatusToDb(input.status)
    if (input.marca != null || input.modelo != null) {
      payload.nome_exibicao = `${input.marca ?? ''} ${input.modelo ?? ''}`.trim()
    }
    if (input.empresa_id != null) payload.empresa_id = input.empresa_id
    if (input.intervalo_manutencao_km != null) payload.intervalo_manutencao_km = input.intervalo_manutencao_km
    if (input.intervalo_manutencao_dias != null) payload.intervalo_manutencao_dias = input.intervalo_manutencao_dias

    return payload
  }

  static toDomain(row: VeiculoRow): Veiculo {
    const anoModelo = row.ano_modelo ?? row.ano ?? 0
    const { marca, modelo } = VeiculoMapper.parseMarcaModelo(row)

    return new Veiculo({
      id: row.id,
      empresaId: row.empresa_id,
      placa: row.placa,
      modelo,
      marca,
      ano: anoModelo,
      anoModelo,
      anoCarroceria: row.ano_carroceria ?? null,
      kmAtual: row.quilometragem_atual ?? row.km_atual ?? 0,
      status: VeiculoMapper.mapStatusFromDb(row.status),
      fotoUrl: row.foto_url ?? null,
      createdAt: row.created_at,
      empresaNome: row.empresas?.nome ?? null,
      intervaloManutencaoKm: row.intervalo_manutencao_km ?? 10000,
      intervaloManutencaoDias: row.intervalo_manutencao_dias ?? 180,
    })
  }

  static toDomainList(rows: VeiculoDTO[] | null): Veiculo[] | null {
    if (!rows) return null
    return rows.map(VeiculoMapper.toDomain)
  }

  static toDTO(entity: Veiculo): VeiculoDTO {
    return entity.toDTO()
  }

  static toDTOList(entities: Veiculo[] | null): VeiculoDTO[] | null {
    if (!entities) return null
    return entities.map(e => e.toDTO())
  }
}
