import type { Reserva as ReservaDTO } from '@/types/database'
import { Reserva } from '@/domain/entities/Reserva'

export class ReservaMapper {
  static toDomain(row: ReservaDTO): Reserva {
    return new Reserva({
      id: row.id,
      empresaId: row.empresa_id,
      veiculoId: row.veiculo_id,
      motoristaId: row.motorista_id,
      dataViagem: row.data_viagem,
      destino: row.destino,
      kmIdaVolta: row.km_ida_volta,
      status: row.status,
      observacaoGestor: row.observacao_gestor,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      veiculoPlaca: row.veiculos?.placa,
      veiculoModelo: row.veiculos?.nome_exibicao ?? row.veiculos?.modelo,
      motoristaNome: row.usuarios?.nome,
    })
  }

  static toDomainList(rows: ReservaDTO[] | null): Reserva[] | null {
    if (!rows) return null
    return rows.map(ReservaMapper.toDomain)
  }

  static toDTOList(entities: Reserva[] | null): ReservaDTO[] | null {
    if (!entities) return null
    return entities.map(e => e.toDTO())
  }
}
