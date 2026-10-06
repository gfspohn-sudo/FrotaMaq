export type PerfilUsuario = 'super_admin' | 'gestor' | 'mecanico' | 'motorista'
export type StatusVeiculo = 'disponivel' | 'em_viagem' | 'em_manutencao' | 'parado'
export type PrioridadeAlerta = 'CRITICA' | 'ALTA' | 'MEDIA'
export type TipoManutencao = 'preventiva' | 'corretiva' | 'preditiva'
export type StatusManutencao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
export type MetodoPagamento = 'cartao' | 'pix' | 'boleto' | 'faturado' | 'dinheiro' | 'transferencia'
export type TipoAlerta = 'vencida' | 'proxima'
export type StatusAlerta = 'ativo' | 'resolvido'
export type MaintenanceUrgency = 'ok' | 'warning' | 'overdue'

export interface TenantFilter {
  empresaId?: string
}
