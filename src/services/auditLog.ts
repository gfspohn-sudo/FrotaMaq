import { listAuditEvents, recordAuditEvent } from '@/application/services/AuditTrailService'
import type { AuditLog } from '@/types/database'

export async function getAuditLogs(filter: {
  empresaId?: string
  veiculoId?: string
  reservaId?: string
  limit?: number
}): Promise<{ data: AuditLog[]; error: null }> {
  const data = await listAuditEvents(filter)
  return { data, error: null }
}

export { recordAuditEvent, listAuditEvents }
