import { supabase } from '@/lib/supabase'
import {
  MOCK_VEICULOS,
  MOCK_PREFIX,
  generateMockManutencoes,
  getMockPlacas,
  estimateMockCount,
} from '@/lib/mockFleetData'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { getEmpresas } from '@/services/empresas'
import type { Veiculo } from '@/types/database'
import type { NovaManutencao } from '@/types/database'

export interface SeedMockFleetResult {
  vehiclesInserted: number
  vehiclesSkipped: number
  maintenancesInserted: number
  totalVehicles: number
  error: Error | null
}

async function getMockVeiculos(): Promise<Veiculo[]> {
  const placas = getMockPlacas()
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .in('placa', placas)

  if (error || !data) return []
  return data as Veiculo[]
}

async function deleteMockManutencoes(veiculoIds: string[]) {
  if (veiculoIds.length === 0) return

  await supabase
    .from('manutencoes')
    .delete()
    .in('veiculo_id', veiculoIds)
    .like('descricao', `${MOCK_PREFIX}%`)
}

async function insertManutencoesBatch(records: NovaManutencao[]) {
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH)
    const { error } = await supabase.from('manutencoes').insert(
      chunk.map(r => ({ ...r, valor: r.valor ?? 0 })),
    )
    if (error) return { inserted, error }
    inserted += chunk.length
  }

  return { inserted, error: null }
}

function resolveEmpresaForIndex(
  index: number,
  preferredEmpresaId: string | undefined,
  empresa1Id: string | undefined,
  empresa2Id: string | undefined,
  fallbackId: string,
): string {
  if (preferredEmpresaId) return preferredEmpresaId
  if (empresa1Id && empresa2Id) {
    return index % 2 === 0 ? empresa1Id : empresa2Id
  }
  return empresa1Id ?? empresa2Id ?? fallbackId
}

export async function seedMockFleet(preferredEmpresaId?: string): Promise<SeedMockFleetResult> {
  const result: SeedMockFleetResult = {
    vehiclesInserted: 0,
    vehiclesSkipped: 0,
    maintenancesInserted: 0,
    totalVehicles: MOCK_VEICULOS.length,
    error: null,
  }

  const { data: empresas, error: empresasError } = await getEmpresas()
  if (empresasError || !empresas?.length) {
    result.error = new Error(
      'Tabela empresas não encontrada. Execute supabase/seed_multi_tenant_demo.sql no Supabase.',
    )
    return result
  }

  const empresa1 = empresas.find(e => e.slug === 'empresa-1') ?? empresas[0]
  const empresa2 = empresas.find(e => e.slug === 'empresa-2') ?? empresas[1] ?? empresas[0]
  const fallbackId = preferredEmpresaId ?? empresa1.id

  const { data: existing, error: fetchError } = await supabase
    .from('veiculos')
    .select('placa')
    .in('placa', getMockPlacas())

  if (fetchError) {
    result.error = fetchError
    return result
  }

  const existingPlacas = new Set(existing?.map(v => v.placa) ?? [])
  const toInsert = MOCK_VEICULOS
    .filter(v => !existingPlacas.has(v.placa))
    .map((v, index) => ({
      ...v,
      empresa_id: resolveEmpresaForIndex(
        index,
        preferredEmpresaId,
        empresa1.id,
        empresa2?.id,
        fallbackId,
      ),
    }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('veiculos').insert(toInsert)
    if (insertError) {
      result.error = insertError
      return result
    }
    result.vehiclesInserted = toInsert.length
  }

  result.vehiclesSkipped = MOCK_VEICULOS.length - toInsert.length

  const mockVeiculos = await getMockVeiculos()
  if (mockVeiculos.length === 0) {
    result.error = new Error('Nenhum veículo de teste encontrado após inserção.')
    return result
  }

  const veiculoIds = mockVeiculos.map(v => v.id)
  await deleteMockManutencoes(veiculoIds)

  const allManutencoes: NovaManutencao[] = []
  mockVeiculos.forEach((veiculo, index) => {
    const empresaId = veiculo.empresa_id ?? fallbackId
    allManutencoes.push(
      ...generateMockManutencoes(veiculo.id, veiculo.km_atual, index, empresaId),
    )
  })

  const { inserted, error: maintError } = await insertManutencoesBatch(allManutencoes)
  result.maintenancesInserted = inserted

  if (maintError) {
    result.error = maintError
    return result
  }

  notifyDataRefresh()
  return result
}

export function getExpectedMockMaintenanceCount(): number {
  return estimateMockCount()
}
