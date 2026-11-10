import { afterEach, describe, expect, it } from 'vitest'
import {
  buildHeuristicFleetSnapshot,
  loadOperationalFleet,
  readFleetSnapshot,
  saveFleetSnapshot,
} from '@/lib/fleetSnapshotCache'
import type { Veiculo } from '@/types/database'

const memory = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) },
  clear: () => memory.clear(),
}

afterEach(() => {
  memory.clear()
})

function vehicle(id: string): Veiculo {
  return {
    id,
    empresa_id: 'emp-1',
    nome_exibicao: 'Toyota Hilux',
    placa: 'ABC-1D23',
    quilometragem_atual: 1000,
    status: 'disponivel',
    created_at: new Date().toISOString(),
  }
}

describe('cache local da frota', () => {
  it('monta snapshot heurístico com veículos, reservas e manutenções', () => {
    const snapshot = buildHeuristicFleetSnapshot('emp-1')
    expect(snapshot.veiculos.length).toBeGreaterThan(0)
    expect(snapshot.reservas.length).toBeGreaterThan(0)
    expect(snapshot.manutencoes.length).toBeGreaterThan(0)
    expect(snapshot.veiculos[0]?.empresa_id).toBe('emp-1')
  })

  it('grava e lê o último snapshot válido', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
    saveFleetSnapshot({
      empresaId: 'emp-1',
      veiculos: [vehicle('v1')],
      reservas: [],
      manutencoes: [],
    })

    const cached = readFleetSnapshot('emp-1')
    expect(cached?.veiculos).toHaveLength(1)
    expect(cached?.veiculos[0]?.id).toBe('v1')
  })

  it('usa heurística quando a API falha e não há cache', async () => {
    const result = await loadOperationalFleet({
      empresaId: 'emp-1',
      veiculos: Promise.resolve({ data: null, error: new Error('Failed to fetch') }),
      reservas: Promise.resolve({ data: null, error: new Error('HTTP 521') }),
    })

    expect(result.source).toBe('heuristic')
    expect(result.veiculos.length).toBeGreaterThan(0)
  })

  it('preserva dados ao vivo quando a API responde', async () => {
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
    const live = [vehicle('live-1')]
    const result = await loadOperationalFleet({
      empresaId: 'emp-1',
      veiculos: Promise.resolve({ data: live, error: null }),
      reservas: Promise.resolve({ data: [], error: null }),
    })

    expect(result.source).toBe('live')
    expect(result.veiculos[0]?.id).toBe('live-1')
    expect(readFleetSnapshot('emp-1')?.veiculos[0]?.id).toBe('live-1')
  })
})
