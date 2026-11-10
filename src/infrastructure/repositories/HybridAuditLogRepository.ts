import { supabase } from '@/lib/supabase'
import { runSupabaseQuery } from '@/lib/supabaseQuery'
import type { AuditLogFilter, IAuditLogRepository, NewAuditLog } from '@/domain/repositories/IAuditLogRepository'
import type { AuditAction, AuditLog } from '@/types/database'

export const AUDIT_LOG_STORAGE_KEY = 'frotamaq:audit-logs'
const LOCAL_CAP = 400

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: string; message?: string }
  const code = record.code ?? ''
  const message = (record.message ?? '').toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || (message.includes('audit_logs') && (message.includes('does not exist') || message.includes('schema cache')))
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toAuditLog(input: NewAuditLog): AuditLog {
  return {
    id: input.id ?? newId(),
    empresa_id: input.empresa_id ?? null,
    usuario_id: input.usuario_id ?? null,
    usuario_nome: input.usuario_nome ?? null,
    veiculo_id: input.veiculo_id ?? null,
    reserva_id: input.reserva_id ?? null,
    acao: input.acao,
    descricao: input.descricao,
    created_at: input.created_at ?? new Date().toISOString(),
  }
}

export function readLocalAuditLogs(): AuditLog[] {
  const db = storage()
  if (!db) return []
  try {
    const raw = db.getItem(AUDIT_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AuditLog[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeLocalAuditLogs(logs: AuditLog[]) {
  const db = storage()
  if (!db) return
  const trimmed = logs
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, LOCAL_CAP)
  db.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(trimmed))
}

export function persistLocalAuditLog(log: AuditLog) {
  const current = readLocalAuditLogs().filter(item => item.id !== log.id)
  writeLocalAuditLogs([log, ...current])
}

export function mergeAuditLogs(...groups: AuditLog[][]): AuditLog[] {
  const map = new Map<string, AuditLog>()
  for (const group of groups) {
    for (const item of group) {
      if (item?.id) map.set(item.id, item)
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function matchesAuditFilter(log: AuditLog, filter?: AuditLogFilter): boolean {
  if (!filter) return true
  if (filter.empresaId && log.empresa_id && log.empresa_id !== filter.empresaId) return false
  if (filter.veiculoId && log.veiculo_id !== filter.veiculoId) return false
  if (filter.reservaId && log.reserva_id !== filter.reservaId) return false
  return true
}

function isAuditAction(value: unknown): value is AuditAction {
  return value === 'viagem_criada' || value === 'veiculo_em_manutencao' || value === 'veiculo_liberado'
}

function mapRow(row: Record<string, unknown>): AuditLog | null {
  if (!isAuditAction(row.acao)) return null
  return {
    id: String(row.id),
    empresa_id: typeof row.empresa_id === 'string' ? row.empresa_id : null,
    usuario_id: typeof row.usuario_id === 'string' ? row.usuario_id : null,
    usuario_nome: typeof row.usuario_nome === 'string' ? row.usuario_nome : null,
    veiculo_id: typeof row.veiculo_id === 'string' ? row.veiculo_id : null,
    reserva_id: typeof row.reserva_id === 'string' ? row.reserva_id : null,
    acao: row.acao,
    descricao: String(row.descricao ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }
}

/** Persistência híbrida: tenta o Supabase e sempre guarda um fallback local. */
export class HybridAuditLogRepository implements IAuditLogRepository {
  async create(input: NewAuditLog) {
    const row = toAuditLog(input)
    persistLocalAuditLog(row)

    const remote = await runSupabaseQuery('audit_logs.create', async () => {
      const { data, error } = await supabase.from('audit_logs').insert({
        id: row.id,
        empresa_id: row.empresa_id,
        usuario_id: row.usuario_id,
        usuario_nome: row.usuario_nome,
        veiculo_id: row.veiculo_id,
        reserva_id: row.reserva_id,
        acao: row.acao,
        descricao: row.descricao,
        created_at: row.created_at,
      }).select('*').single()
      return { data, error }
    })

    if (remote.error && !isMissingRelation(remote.error)) {
      return { data: row, error: remote.error }
    }

    return { data: row, error: null }
  }

  async findAll(filter?: AuditLogFilter) {
    const local = readLocalAuditLogs().filter(item => matchesAuditFilter(item, filter))
    const limit = filter?.limit ?? 40

    const remote = await runSupabaseQuery('audit_logs.findAll', async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
      if (filter?.veiculoId) query = query.eq('veiculo_id', filter.veiculoId)
      if (filter?.reservaId) query = query.eq('reserva_id', filter.reservaId)

      const { data, error } = await query
      return { data, error }
    })

    const remoteRows = !remote.error && Array.isArray(remote.data)
      ? remote.data.map(item => mapRow(item as Record<string, unknown>)).filter((item): item is AuditLog => item != null)
      : []

    if (remote.error && !isMissingRelation(remote.error)) {
      return { data: local.slice(0, limit), error: remote.error }
    }

    return { data: mergeAuditLogs(remoteRows, local).slice(0, limit), error: null }
  }
}
