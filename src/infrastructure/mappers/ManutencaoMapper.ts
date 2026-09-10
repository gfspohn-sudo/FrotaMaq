import type { Manutencao as ManutencaoDTO } from '@/types/database'
import { Manutencao } from '@/domain/entities/Manutencao'

export class ManutencaoMapper {
  static toDomain(row: ManutencaoDTO): Manutencao {
    return new Manutencao({
      id: row.id,
      empresaId: row.empresa_id,
      veiculoId: row.veiculo_id,
      tipo: row.tipo,
      descricao: row.descricao,
      dataHora: row.data_hora,
      local: row.local,
      responsavel: row.responsavel,
      valor: row.valor,
      metodoPagamento: row.metodo_pagamento,
      proximaManutencaoPrevisao: row.proxima_manutencao_previsao,
      proximaManutencaoData: row.proxima_manutencao_data,
      proximaManutencaoKm: row.proxima_manutencao_km,
      status: row.status,
      createdAt: row.created_at,
      veiculoResumo: row.veiculos
        ? {
            placa: row.veiculos.placa,
            modelo: row.veiculos.modelo,
            marca: row.veiculos.marca,
            kmAtual: row.veiculos.km_atual,
          }
        : null,
    })
  }

  static toDomainList(rows: ManutencaoDTO[] | null): Manutencao[] | null {
    if (!rows) return null
    return rows.map(ManutencaoMapper.toDomain)
  }

  static toDTO(entity: Manutencao): ManutencaoDTO {
    return entity.toDTO()
  }

  static toDTOList(entities: Manutencao[] | null): ManutencaoDTO[] | null {
    if (!entities) return null
    return entities.map(e => e.toDTO())
  }
}
