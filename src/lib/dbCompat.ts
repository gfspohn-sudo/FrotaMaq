import type { Manutencao, StatusManutencao, TipoManutencao, Veiculo } from '@/types/database'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'

export function getVeiculoKm(veiculo: Pick<Veiculo, 'quilometragem_atual' | 'km_atual'>): number {
  return veiculo.quilometragem_atual ?? veiculo.km_atual ?? 0
}

export function getManutencaoData(m: Manutencao): string {
  return m.data_manutencao ?? m.data_hora ?? m.created_at
}

export function getManutencaoProximaData(m: Manutencao): string | null {
  return m.data_proxima_manutencao ?? m.proxima_manutencao_data ?? null
}

export function getManutencaoLocal(m: Manutencao): string | null {
  return m.local_manutencao ?? m.local ?? null
}

export function getManutencaoFormaPagamento(m: Manutencao): string | null {
  if (m.forma_pagamento) return m.forma_pagamento
  if (m.metodo_pagamento) return m.metodo_pagamento
  return null
}

export function getManutencaoValor(m: Manutencao): number {
  return m.valor_total ?? m.valor ?? 0
}

export function getManutencaoStatus(m: Manutencao): StatusManutencao {
  if (m.status) return ManutencaoMapper.normalizeStatusFromDb(m.status)
  return ManutencaoMapper.deriveStatus(getManutencaoData(m))
}

export function isManutencaoAtiva(status: StatusManutencao | string | undefined): boolean {
  const normalized = ManutencaoMapper.normalizeStatusFromDb(status)
  return normalized === 'pendente' || normalized === 'em_andamento'
}

export function isManutencaoVencida(m: Manutencao, now = Date.now()): boolean {
  if (!isManutencaoAtiva(getManutencaoStatus(m))) return false

  const dataManutencao = new Date(getManutencaoData(m)).getTime()
  if (!Number.isNaN(dataManutencao) && dataManutencao < now) return true

  const proxima = getManutencaoProximaData(m)
  if (proxima) {
    const dataProxima = new Date(proxima).getTime()
    if (!Number.isNaN(dataProxima) && dataProxima < now) return true
  }

  return false
}

export function normalizeTipoManutencao(tipo: string | undefined): TipoManutencao {
  return ManutencaoMapper.normalizeTipoFromDb(tipo ?? 'preventiva')
}

export function getVeiculoModelo(v: Veiculo): string {
  return v.modelo ?? v.nome_exibicao ?? v.placa
}

export function getVeiculoMarca(v: Veiculo): string {
  return v.marca ?? v.nome_exibicao?.split(/\s+/)[0] ?? '—'
}
