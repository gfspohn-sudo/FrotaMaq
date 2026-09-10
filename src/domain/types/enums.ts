export type PerfilUsuario = 'super_admin' | 'gestor' | 'gerente' | 'mecanico' | 'motorista'
export type StatusVeiculo = 'em_operacao' | 'em_manutencao' | 'fora_de_operacao'
export type TipoManutencao = 'preventiva' | 'corretiva' | 'preditiva'
export type StatusManutencao = 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
export type MetodoPagamento = 'cartao' | 'pix' | 'boleto' | 'faturado' | 'dinheiro' | 'transferencia'
export type TipoAlerta = 'vencida' | 'proxima'
export type StatusAlerta = 'ativo' | 'resolvido'
export type MaintenanceUrgency = 'ok' | 'warning' | 'overdue'

export interface TenantFilter {
  empresaId?: string
}
