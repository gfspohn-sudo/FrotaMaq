import type { Manutencao, MaintenanceUrgency } from '@/types/database'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import { MaintenanceUrgencyService } from '@/domain/services/MaintenanceUrgencyService'
import { Money } from '@/domain/value-objects/Money'

export function getMaintenanceUrgency(
  m: Manutencao,
  veiculoKm?: number,
): MaintenanceUrgency {
  const entity = ManutencaoMapper.toDomain(m)
  return entity.calcularUrgencia(veiculoKm)
}

export function getVehicleName(m: Manutencao): string {
  return ManutencaoMapper.toDomain(m).nomeVeiculo
}

export function formatCurrency(value: number) {
  return Money.from(value).format()
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export { MaintenanceUrgencyService }
