import type { Veiculo as VeiculoDTO } from '@/types/database'
import { Veiculo } from '@/domain/entities/Veiculo'

export class VeiculoMapper {
  static toDomain(row: VeiculoDTO): Veiculo {
    const anoModelo = row.ano_modelo ?? row.ano
    return new Veiculo({
      id: row.id,
      empresaId: row.empresa_id,
      placa: row.placa,
      modelo: row.modelo,
      marca: row.marca,
      ano: anoModelo,
      anoModelo,
      anoCarroceria: row.ano_carroceria ?? null,
      kmAtual: row.km_atual,
      status: row.status,
      fotoUrl: row.foto_url,
      createdAt: row.created_at,
      empresaNome: row.empresas?.nome ?? null,
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
