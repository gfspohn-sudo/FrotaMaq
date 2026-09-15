import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import type { Usuario } from '@/types/database'

export type { NotificationItem } from '@/application/use-cases/GetNotificationsUseCase'

export async function getNotifications(profile: Usuario | null, empresaId?: string) {
  const result = await container.getNotifications.execute(profile, empresaId)
  return { ...result, error: asServiceError(result.error) }
}
