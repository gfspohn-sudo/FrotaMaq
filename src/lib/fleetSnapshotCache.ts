import {
  generateMockManutencoes,
  generateMockReservas,
  MOCK_VEICULOS,
} from '@/lib/mockFleetData'
import type { Manutencao, Reserva, Veiculo } from '@/types/database'

export const FLEET_SNAPSHOT_KEY = 'frotamaq:fleet-snapshot'
const HEURISTIC_EMPRESA = 'local-heuristic'

export type FleetDataSource = 'live' | 'cache' | 'heuristic'

export interface FleetSnapshot {
  savedAt: string
  empresaId: string | null
  veiculos: Veiculo[]
  reservas: Reserva[]
  manutencoes: Manutencao[]
}

interface LiveQuery<T> {
  data: T[] | null
  error?: unknown
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function saveFleetSnapshot(snapshot: Omit<FleetSnapshot, 'savedAt'>): FleetSnapshot {
  const payload: FleetSnapshot = {
    ...snapshot,
    savedAt: new Date().toISOString(),
  }

  const db = storage()
  if (db) {
    db.setItem(FLEET_SNAPSHOT_KEY, JSON.stringify(payload))
  }

  return payload
}

export function readFleetSnapshot(empresaId?: string | null): FleetSnapshot | null {
  const db = storage()
  if (!db) return null

  try {
    const raw = db.getItem(FLEET_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FleetSnapshot
    if (!parsed || !Array.isArray(parsed.veiculos)) return null
    if (empresaId && parsed.empresaId && parsed.empresaId !== empresaId) return null
    return parsed
  } catch {
    return null
  }
}

export function buildHeuristicFleetSnapshot(empresaId?: string | null): FleetSnapshot {
  const tenantId = empresaId || HEURISTIC_EMPRESA
  const veiculos: Veiculo[] = MOCK_VEICULOS.map((item, index) => ({
    id: `local-${index}-${item.placa}`,
    empresa_id: tenantId,
    nome_exibicao: `${item.marca} ${item.modelo}`,
    placa: item.placa,
    ano: item.ano,
    ano_modelo: item.ano,
    quilometragem_atual: item.km_atual,
    km_atual: item.km_atual,
    status: item.status,
    created_at: new Date().toISOString(),
    marca: item.marca,
    modelo: item.modelo,
  }))

  const reservas: Reserva[] = []
  const manutencoes: Manutencao[] = []

  veiculos.forEach((veiculo, index) => {
    generateMockReservas({
      veiculoId: veiculo.id,
      kmAtual: veiculo.quilometragem_atual,
      vehicleIndex: index,
      empresaId: tenantId,
      motoristaId: 'local-driver',
      status: veiculo.status,
    }).forEach((reserva, reservaIndex) => {
      reservas.push({
        id: `${veiculo.id}-reserva-${reservaIndex}`,
        empresa_id: reserva.empresa_id,
        veiculo_id: reserva.veiculo_id,
        motorista_id: reserva.motorista_id,
        data_viagem: reserva.data_viagem,
        destino: reserva.destino,
        km_ida_volta: reserva.km_ida_volta,
        km_inicial: reserva.km_inicial,
        km_final: reserva.km_final,
        km_percorrido: reserva.km_final != null && reserva.km_inicial != null
          ? Math.max(0, reserva.km_final - reserva.km_inicial)
          : null,
        status: reserva.status,
        observacao_gestor: reserva.observacao_gestor,
        motivo_recusa: reserva.motivo_recusa,
        created_at: reserva.data_viagem,
        updated_at: reserva.data_viagem,
        veiculos: { placa: veiculo.placa, modelo: veiculo.modelo, nome_exibicao: veiculo.nome_exibicao },
      })
    })

    generateMockManutencoes(
      veiculo.id,
      veiculo.quilometragem_atual,
      index,
      tenantId,
      veiculo.status,
    ).forEach((item, maintenanceIndex) => {
      const valor = (item.valor_mao_de_obra ?? 0) + (item.valor_pecas ?? 0)
      manutencoes.push({
        id: `${veiculo.id}-manut-${maintenanceIndex}`,
        empresa_id: item.empresa_id ?? tenantId,
        veiculo_id: item.veiculo_id,
        descricao: item.descricao,
        valor_total: valor,
        data_manutencao: item.data_hora,
        data_proxima_manutencao: item.data_proxima_manutencao,
        km_atual_veiculo: item.km_atual_veiculo,
        pecas_trocadas: item.pecas_trocadas,
        valor_mao_de_obra: item.valor_mao_de_obra,
        valor_pecas: item.valor_pecas,
        observacao: item.observacao,
        proxima_manutencao_km: item.proxima_manutencao_km,
        tipo: item.tipo,
        status: item.status ?? 'concluida',
        forma_pagamento: item.forma_pagamento,
        local_manutencao: item.local_manutencao,
        responsavel: item.responsavel,
        created_at: item.data_hora,
        data_hora: item.data_hora,
        valor,
        local: item.local_manutencao,
        veiculos: {
          placa: veiculo.placa,
          modelo: veiculo.modelo,
          nome_exibicao: veiculo.nome_exibicao,
          marca: veiculo.marca,
          quilometragem_atual: veiculo.quilometragem_atual,
          km_atual: veiculo.km_atual ?? undefined,
        },
      })
    })
  })

  return {
    savedAt: new Date().toISOString(),
    empresaId: tenantId,
    veiculos,
    reservas,
    manutencoes,
  }
}

export async function loadOperationalFleet(params: {
  empresaId?: string | null
  veiculos: Promise<LiveQuery<Veiculo>>
  reservas: Promise<LiveQuery<Reserva>>
  manutencoes?: Promise<LiveQuery<Manutencao>>
}): Promise<FleetSnapshot & { source: FleetDataSource }> {
  let liveFailed = false
  let veiculos: Veiculo[] = []
  let reservas: Reserva[] = []
  let manutencoes: Manutencao[] = []

  try {
    const [veiculosRes, reservasRes, manutencoesRes] = await Promise.all([
      params.veiculos,
      params.reservas,
      params.manutencoes ?? Promise.resolve({ data: [] as Manutencao[], error: null }),
    ])

    liveFailed = Boolean(veiculosRes.error || reservasRes.error || manutencoesRes.error)
    veiculos = veiculosRes.data ?? []
    reservas = reservasRes.data ?? []
    manutencoes = manutencoesRes.data ?? []
  } catch {
    liveFailed = true
  }

  if (!liveFailed) {
    const snapshot = saveFleetSnapshot({
      empresaId: params.empresaId ?? null,
      veiculos,
      reservas,
      manutencoes,
    })
    return { ...snapshot, source: 'live' }
  }

  const cached = readFleetSnapshot(params.empresaId)
  if (cached) return { ...cached, source: 'cache' }

  return { ...buildHeuristicFleetSnapshot(params.empresaId), source: 'heuristic' }
}
