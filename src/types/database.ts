export type PerfilUsuario = 'super_admin' | 'gestor' | 'gerente' | 'mecanico' | 'motorista'
export type StatusVeiculo = 'em_operacao' | 'em_manutencao' | 'fora_de_operacao'
export type TipoManutencao = 'preventiva' | 'corretiva' | 'preditiva'
export type StatusManutencao = 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
export type MetodoPagamento = 'cartao' | 'pix' | 'boleto' | 'faturado' | 'dinheiro' | 'transferencia'
export type TipoAlerta = 'vencida' | 'proxima'
export type StatusAlerta = 'ativo' | 'resolvido'
export type MaintenanceUrgency = 'ok' | 'warning' | 'overdue'

export interface Empresa {
  id: string
  nome: string
  cnpj?: string | null
  slug: string
  created_at: string
}

export interface Usuario {
  id: string
  email: string
  nome: string
  perfil: PerfilUsuario
  empresa_id: string | null
  created_at: string
}

export interface Veiculo {
  id: string
  empresa_id: string | null
  placa: string
  modelo: string
  marca: string
  ano: number
  km_atual: number
  status: StatusVeiculo
  foto_url: string | null
  created_at: string
}

export interface Manutencao {
  id: string
  empresa_id: string | null
  veiculo_id: string
  tipo: TipoManutencao
  descricao: string
  data_hora: string
  local: string | null
  responsavel: string | null
  valor: number
  metodo_pagamento: MetodoPagamento | null
  proxima_manutencao_previsao: string | null
  proxima_manutencao_data: string | null
  proxima_manutencao_km: number | null
  status: StatusManutencao
  created_at: string
  veiculos?: Pick<Veiculo, 'placa' | 'modelo' | 'marca' | 'km_atual'>
}

export interface Alerta {
  id: string
  empresa_id: string | null
  veiculo_id: string
  tipo: TipoAlerta
  mensagem: string
  data_vencimento: string
  status: StatusAlerta
  created_at: string
  veiculos?: Pick<Veiculo, 'placa' | 'modelo' | 'marca'>
}

export interface NovaManutencao {
  veiculo_id: string
  empresa_id?: string
  tipo: TipoManutencao
  descricao: string
  data_hora: string
  local?: string
  responsavel?: string
  valor?: number
  metodo_pagamento?: MetodoPagamento
  proxima_manutencao_previsao?: string
  proxima_manutencao_data?: string
  proxima_manutencao_km?: number
  status?: StatusManutencao
}

export interface NovoVeiculo {
  empresa_id?: string
  placa: string
  modelo: string
  marca: string
  ano: number
  km_atual: number
  status: StatusVeiculo
  foto_url?: string
}

export const STATUS_VEICULO_LABELS: Record<StatusVeiculo, string> = {
  em_operacao: 'Em operação',
  em_manutencao: 'Em manutenção',
  fora_de_operacao: 'Fora de operação',
}

export const STATUS_VEICULO_COLORS: Record<StatusVeiculo, string> = {
  em_operacao: 'bg-success/10 text-success',
  em_manutencao: 'bg-warning/10 text-warning',
  fora_de_operacao: 'bg-danger/10 text-danger',
}

export const TIPO_MANUTENCAO_LABELS: Record<TipoManutencao, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  preditiva: 'Preditiva',
}

export const METODO_PAGAMENTO_LABELS: Record<MetodoPagamento, string> = {
  cartao: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto',
  faturado: 'Faturado',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
}

export const STATUS_MANUTENCAO_LABELS: Record<StatusManutencao, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const TIPO_ALERTA_COLORS: Record<TipoAlerta, string> = {
  vencida: 'text-danger',
  proxima: 'text-warning',
}

export const URGENCY_LABELS: Record<MaintenanceUrgency, string> = {
  ok: 'Em dia',
  warning: 'Próxima / Alerta',
  overdue: 'Vencida',
}

export const URGENCY_BORDER: Record<MaintenanceUrgency, string> = {
  ok: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  overdue: 'border-l-4 border-l-danger',
}

export const URGENCY_BG: Record<MaintenanceUrgency, string> = {
  ok: 'bg-success/5',
  warning: 'bg-warning/5',
  overdue: 'bg-danger/5',
}

export const URGENCY_DOT: Record<MaintenanceUrgency, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  overdue: 'bg-danger',
}

export const URGENCY_TEXT: Record<MaintenanceUrgency, string> = {
  ok: 'text-success',
  warning: 'text-warning',
  overdue: 'text-danger',
}
