import { supabase } from '@/lib/supabase'
import {
  MOCK_VEICULOS,
  MOCK_PREFIX,
  generateMockManutencoes,
  getMockPlacas,
  estimateMockCount,
} from '@/lib/mockFleetData'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { toError } from '@/lib/formatError'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { NovaManutencao } from '@/types/database'

export interface SeedMockFleetResult {
  vehiclesInserted: number
  vehiclesSkipped: number
  maintenancesInserted: number
  totalVehicles: number
  error: Error | null
}

interface MockVeiculoRow {
  id: string
  empresa_id: string | null
  placa: string
  quilometragem_atual?: number
  km_atual?: number
}

function readKmAtual(veiculo: MockVeiculoRow): number {
  return veiculo.quilometragem_atual ?? veiculo.km_atual ?? 0
}

async function getMockVeiculos(empresaId: string): Promise<MockVeiculoRow[]> {
  const placas = getMockPlacas()
  const { data, error } = await supabase
    .from('veiculos')
    .select('id, empresa_id, placa, quilometragem_atual, km_atual')
    .eq('empresa_id', empresaId)
    .in('placa', placas)

  if (error) throw toError(error)
  return (data ?? []) as MockVeiculoRow[]
}

async function deleteMockManutencoes(veiculoIds: string[]) {
  if (veiculoIds.length === 0) return

  const { error } = await supabase
    .from('manutencoes')
    .delete()
    .in('veiculo_id', veiculoIds)
    .like('descricao', `${MOCK_PREFIX}%`)

  if (error) throw toError(error)
}

async function insertManutencoesBatch(records: NovaManutencao[]) {
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH).map(ManutencaoMapper.toDbPayload)
    const { error } = await supabase.from('manutencoes').insert(chunk)
    if (error) throw toError(error)
    inserted += chunk.length
  }

  return inserted
}

export async function seedMockFleet(empresaId: string): Promise<SeedMockFleetResult> {
  const result: SeedMockFleetResult = {
    vehiclesInserted: 0,
    vehiclesSkipped: 0,
    maintenancesInserted: 0,
    totalVehicles: MOCK_VEICULOS.length,
    error: null,
  }

  if (!empresaId) {
    result.error = new Error('Selecione uma empresa antes de popular veículos de teste.')
    return result
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('veiculos')
      .select('placa')
      .eq('empresa_id', empresaId)
      .in('placa', getMockPlacas())

    if (fetchError) throw toError(fetchError)

    const existingPlacas = new Set(existing?.map(v => v.placa) ?? [])
    const toInsert = MOCK_VEICULOS
      .filter(v => !existingPlacas.has(v.placa))
      .map(v => VeiculoMapper.toDbPayload({ ...v, empresa_id: empresaId }))

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('veiculos').insert(toInsert)
      if (insertError) throw toError(insertError)
      result.vehiclesInserted = toInsert.length
    }

    result.vehiclesSkipped = MOCK_VEICULOS.length - toInsert.length

    const mockVeiculos = await getMockVeiculos(empresaId)
    if (mockVeiculos.length === 0) {
      throw new Error('Nenhum veículo de teste encontrado após inserção.')
    }

    const veiculoIds = mockVeiculos.map(v => v.id)
    await deleteMockManutencoes(veiculoIds)

    const allManutencoes: NovaManutencao[] = []
    mockVeiculos.forEach((veiculo, index) => {
      const veiculoEmpresaId = veiculo.empresa_id ?? empresaId
      allManutencoes.push(
        ...generateMockManutencoes(
          veiculo.id,
          readKmAtual(veiculo),
          index,
          veiculoEmpresaId,
        ),
      )
    })

    result.maintenancesInserted = await insertManutencoesBatch(allManutencoes)
    notifyDataRefresh()
  } catch (err) {
    result.error = toError(err)
  }

  return result
}

export function getExpectedMockMaintenanceCount(): number {
  return estimateMockCount()
}
