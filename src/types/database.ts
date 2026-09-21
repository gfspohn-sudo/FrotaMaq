/** Tipos alinhados ao schema PostgreSQL/Supabase (FrotaMaq). */

export type PerfilUsuario = 'super_admin' | 'gestor' | 'mecanico' | 'motorista'
export type StatusVeiculo = 'em_operacao' | 'em_manutencao' | 'fora_de_operacao'
export type TipoManutencao = 'preventiva' | 'corretiva' | 'preditiva'
export type StatusManutencaoDb = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'
export type StatusManutencao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
export type MetodoPagamento = 'cartao' | 'pix' | 'boleto' | 'faturado' | 'dinheiro' | 'transferencia'
export type TipoAlerta = 'vencida' | 'proxima'
export type StatusAlerta = 'ativo' | 'resolvido'
export type MaintenanceUrgency = 'ok' | 'warning' | 'overdue'
export type StatusReserva = 'PENDENTE' | 'APROVADO' | 'REJEITADO'
export type StatusSolicitacaoRelatorio = 'PENDENTE' | 'APROVADO' | 'REJEITADO'
export type PerfilChaveConvite = 'motorista' | 'mecanico'

export interface Empresa {
  id: string
  nome: string
  cnpj?: string | null
  slug?: string | null
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

/** Linha da tabela `veiculos` + campos derivados para a UI. */
export interface Veiculo {
  id: string
  empresa_id: string | null
  nome_exibicao: string
  placa: string
  ano?: number | null
  ano_modelo?: number | null
  ano_carroceria?: number | null
  quilometragem_atual: number
  km_atual?: number | null
  status: StatusVeiculo
  created_at: string
  /** Derivados no mapper a partir de `nome_exibicao` (compatibilidade UI). */
  marca?: string
  modelo?: string
  foto_url?: string | null
  empresas?: Pick<Empresa, 'nome'>
}

export interface Reserva {
  id: string
  empresa_id: string
  veiculo_id: string
  motorista_id: string
  data_viagem: string
  destino: string
  km_ida_volta: number
  status: StatusReserva
  observacao_gestor: string | null
  created_at: string
  updated_at: string
  veiculos?: { placa: string; nome_exibicao?: string; modelo?: string }
  usuarios?: Pick<Usuario, 'nome'>
}

export interface NovaReserva {
  veiculo_id: string
  empresa_id?: string
  data_viagem: string
  destino: string
  km_ida_volta: number
}

/** Linha da tabela `manutencoes` + aliases para a UI. */
export interface Manutencao {
  id: string
  empresa_id: string | null
  veiculo_id: string
  descricao: string
  valor_total: number
  data_manutencao: string
  data_proxima_manutencao?: string | null
  tipo: string
  status: StatusManutencao
  forma_pagamento?: string | null
  local_manutencao?: string | null
  responsavel?: string | null
  created_at: string
  /** Aliases UI (ManutencaoMapper). */
  tipo_normalizado?: TipoManutencao
  data_hora?: string
  valor?: number
  local?: string | null
  metodo_pagamento?: MetodoPagamento | null
  proxima_manutencao_data?: string | null
  veiculos?: {
    placa: string
    nome_exibicao?: string
    modelo?: string
    marca?: string
    quilometragem_atual?: number
    km_atual?: number
  }
}

/** Payload de criação — convertido para colunas DB no ManutencaoMapper. */
export interface NovaManutencao {
  veiculo_id: string
  empresa_id?: string
  tipo: TipoManutencao
  descricao: string
  data_hora: string
  valor?: number
  status?: StatusManutencao
  local_manutencao?: string | null
  responsavel?: string | null
  forma_pagamento?: string | null
  data_proxima_manutencao?: string | null
}

/** Payload de criação — marca/modelo convertidos para `nome_exibicao` no mapper. */
export interface NovoVeiculo {
  empresa_id?: string
  placa: string
  modelo: string
  marca: string
  ano: number
  ano_modelo?: number
  ano_carroceria?: number | null
  km_atual: number
  status: StatusVeiculo
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
  veiculos?: { placa: string; nome_exibicao?: string; modelo?: string; marca?: string }
}

export interface ChaveConvite {
  id: string
  empresa_id: string
  token: string
  perfil: PerfilChaveConvite
  ativa: boolean
  created_at: string
}

export interface SolicitacaoRelatorio {
  id: string
  empresa_id: string
  veiculo_id: string
  solicitante_id: string
  status: StatusSolicitacaoRelatorio
  observacao_gestor: string | null
  created_at: string
  updated_at: string
  veiculos?: { placa: string; nome_exibicao?: string; modelo?: string }
  usuarios?: Pick<Usuario, 'nome'>
}

export const STATUS_RESERVA_LABELS: Record<StatusReserva, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
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
  pendente: 'Pendente',
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
