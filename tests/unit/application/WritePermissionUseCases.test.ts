import { describe, expect, it, vi } from 'vitest'
import { CreateVeiculoUseCase, UpdateVeiculoUseCase, DeleteVeiculoUseCase, DeleteAllVeiculosUseCase } from '@/application/use-cases/VeiculoUseCases'
import { CreateManutencaoUseCase } from '@/application/use-cases/ManutencaoUseCases'
import type { Usuario } from '@/types/database'

function profile(perfil: Usuario['perfil']): Usuario {
  return {
    id: 'user-1',
    email: `${perfil}@test.com`,
    nome: perfil,
    perfil,
    empresa_id: 'emp-1',
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

const novoVeiculo = {
  placa: 'ABC1D23',
  modelo: 'FH',
  marca: 'Volvo',
  ano: 2022,
  km_atual: 1000,
  status: 'em_operacao' as const,
  empresa_id: 'emp-1',
}

describe('Write use-cases — autorização por papel', () => {
  it('CreateVeiculo recusa motorista e aceita gestor', async () => {
    const create = vi.fn().mockResolvedValue({ data: null, error: null })
    const useCase = new CreateVeiculoUseCase({ create } as never)

    const denied = await useCase.execute(novoVeiculo, profile('motorista'))
    expect(denied.error).toBeInstanceOf(Error)
    expect(create).not.toHaveBeenCalled()

    await useCase.execute(novoVeiculo, profile('gestor'))
    expect(create).toHaveBeenCalledOnce()
  })

  it('UpdateVeiculo permite KM ao mecânico e recusa alteração de placa', async () => {
    const update = vi.fn().mockResolvedValue({ data: null, error: null })
    const useCase = new UpdateVeiculoUseCase({ update } as never)

    const km = await useCase.execute('v1', { km_atual: 2000 }, 'emp-1', profile('mecanico'))
    expect(km.error).toBeNull()
    expect(update).toHaveBeenCalledOnce()

    const placa = await useCase.execute('v1', { placa: 'XXX0000' } as never, 'emp-1', profile('mecanico'))
    expect(placa.error).toBeInstanceOf(Error)
    expect(update).toHaveBeenCalledOnce()
  })

  it('DeleteVeiculo e DeleteAll recusam motorista', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const deleteAll = vi.fn().mockResolvedValue({ error: null })
    const del = new DeleteVeiculoUseCase({ delete: remove } as never)
    const delAll = new DeleteAllVeiculosUseCase({ deleteAll } as never)

    expect((await del.execute('v1', 'emp-1', profile('motorista'))).error).toBeInstanceOf(Error)
    expect((await delAll.execute('emp-1', profile('motorista'))).error).toBeInstanceOf(Error)
    expect(remove).not.toHaveBeenCalled()
    expect(deleteAll).not.toHaveBeenCalled()
  })

  it('CreateManutencao recusa motorista e aceita mecânico', async () => {
    const create = vi.fn().mockResolvedValue({ data: null, error: null })
    const useCase = new CreateManutencaoUseCase({ create } as never)
    const input = { veiculo_id: 'v1', descricao: 'óleo', valor_total: 10, tipo: 'PREVENTIVA', empresa_id: 'emp-1' }

    const denied = await useCase.execute(input as never, profile('motorista'))
    expect(denied.error).toBeInstanceOf(Error)
    expect(create).not.toHaveBeenCalled()

    await useCase.execute(input as never, profile('mecanico'))
    expect(create).toHaveBeenCalledOnce()
  })
})
