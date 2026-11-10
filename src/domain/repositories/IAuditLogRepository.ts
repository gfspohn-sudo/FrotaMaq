import type { AuditAction, AuditLog } from '@/types/database'

export interface NewAuditLog {
  id?: string
  empresa_id?: string | null
  usuario_id?: string | null
  usuario_nome?: string | null
  veiculo_id?: string | null
  reserva_id?: string | null
  acao: AuditAction
  descricao: string
  created_at?: string
}

export interface AuditLogFilter {
  empresaId?: string
  veiculoId?: string
  reservaId?: string
  limit?: number
}

export interface IAuditLogRepository {
  create(input: NewAuditLog): Promise<{ data: AuditLog | null; error: unknown }>
  findAll(filter?: AuditLogFilter): Promise<{ data: AuditLog[]; error: unknown }>
}
