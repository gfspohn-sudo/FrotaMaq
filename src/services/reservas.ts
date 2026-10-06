import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import type { Usuario, NovaReserva, StatusReserva, Reserva } from '@/types/database'

export async function getReservas(
  profile: Usuario | null,
  filter?: { empresaId?: string; status?: StatusReserva },
) {
  const result = await container.listReservas.execute(profile, filter)
  return { ...result, error: asServiceError(result.error) }
}

export async function solicitarReserva(profile: Usuario | null, input: NovaReserva) {
  const result = await container.solicitarReserva.execute(profile, input)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function aprovarReserva(profile: Usuario | null, id: string) {
  const result = await container.atualizarStatusReserva.execute(profile, id, 'APROVADO')
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function rejeitarReserva(profile: Usuario | null, id: string, motivoRecusa: string) {
  const result = await container.atualizarStatusReserva.execute(profile, id, 'REJEITADO', motivoRecusa)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function finalizarViagem(profile: Usuario | null, id: string, kmFinal: number) {
  const result = await container.finalizarViagem.execute(profile, id, kmFinal)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function getDriverTripHistory(profile: Usuario | null) {
  const result = await container.getDriverTripHistory.execute(profile)
  return { ...result, error: asServiceError(result.error) }
}

export type { Reserva }
