import { describe, it, expect } from 'vitest'
import { createVeiculo } from '../../helpers/fixtures'

describe('Veiculo — nome de exibição', () => {
  it('segue padrão [Empresa] - [Placa]', () => {
    const veiculo = createVeiculo({ placa: 'abc1d23', empresaNome: 'Empresa ABC' })
    expect(veiculo.nomeExibicao('Empresa ABC')).toBe('Empresa ABC - ABC1D23')
  })
})
