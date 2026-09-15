import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import type { Usuario } from '@/types/database'

export type { VeiculoReportResult } from '@/application/use-cases/GetVeiculoReportUseCase'

export async function getVeiculoReport(profile: Usuario | null, veiculoId: string) {
  const result = await container.getVeiculoReport.execute(profile, veiculoId)
  return { ...result, error: asServiceError(result.error) }
}
