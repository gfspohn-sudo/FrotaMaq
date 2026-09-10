import type { Empresa as EmpresaDTO } from '@/types/database'
import { Empresa } from '@/domain/entities/Empresa'

export class EmpresaMapper {
  static toDomain(row: EmpresaDTO): Empresa {
    return new Empresa({
      id: row.id,
      nome: row.nome,
      slug: row.slug,
      cnpj: row.cnpj,
      createdAt: row.created_at,
    })
  }

  static toDomainList(rows: EmpresaDTO[] | null): Empresa[] | null {
    if (!rows) return null
    return rows.map(EmpresaMapper.toDomain)
  }
}
