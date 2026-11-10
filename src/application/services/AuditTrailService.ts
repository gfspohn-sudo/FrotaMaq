import { HybridAuditLogRepository } from '@/infrastructure/repositories/HybridAuditLogRepository'
import type { IAuditLogRepository, NewAuditLog } from '@/domain/repositories/IAuditLogRepository'
import { AUDIT_ACTION_LABELS, type AuditAction, type AuditLog, type Usuario } from '@/types/database'

export interface RecordAuditInput {
  acao: AuditAction
  profile?: Usuario | null
  empresaId?: string | null
  veiculoId?: string | null
  reservaId?: string | null
  detalhe?: string
}

export function buildAuditLog(input: RecordAuditInput): NewAuditLog {
  const base = AUDIT_ACTION_LABELS[input.acao]
  return {
    acao: input.acao,
    descricao: input.detalhe ? `${base} — ${input.detalhe}` : base,
    empresa_id: input.empresaId ?? input.profile?.empresa_id ?? null,
    usuario_id: input.profile?.id ?? null,
    usuario_nome: input.profile?.nome?.trim() || input.profile?.email || null,
    veiculo_id: input.veiculoId ?? null,
    reserva_id: input.reservaId ?? null,
  }
}

let repository: IAuditLogRepository = new HybridAuditLogRepository()

export function configureAuditTrail(repo: IAuditLogRepository) {
  repository = repo
}

/** Grava o evento sem interromper a operação principal. */
export async function recordAuditEvent(input: RecordAuditInput): Promise<AuditLog | null> {
  try {
    const { data } = await repository.create(buildAuditLog(input))
    return data
  } catch {
    return null
  }
}

export async function listAuditEvents(filter: {
  empresaId?: string
  veiculoId?: string
  reservaId?: string
  limit?: number
}): Promise<AuditLog[]> {
  try {
    const { data } = await repository.findAll(filter)
    return data ?? []
  } catch {
    return []
  }
}
