export type StatusReserva = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'CONCLUIDA'

export const STATUS_RESERVA_LABELS: Record<StatusReserva, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  CONCLUIDA: 'Concluída',
}
