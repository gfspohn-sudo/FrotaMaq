import { describe, it, expect } from 'vitest'
import { createManutencao } from '../../helpers/fixtures'
import { sumMaintenanceValues } from '@/lib/financialUtils'

describe('Manutencao — Valor Total', () => {
  it('calcularValorTotal retorna o valor da manutenção', () => {
    const manutencao = createManutencao({ valor: 1250.75 })
    expect(manutencao.calcularValorTotal().value).toBeCloseTo(1250.75)
  })

  it('sumMaintenanceValues consolida valor total de múltiplas manutenções', () => {
    const rows = [
      createManutencao({ id: 'm1', valor: 500 }),
      createManutencao({ id: 'm2', valor: 750.25 }),
    ]
    const total = sumMaintenanceValues(rows.map(m => ({ valor: m.calcularValorTotal().value })))
    expect(total).toBeCloseTo(1250.25)
  })
})
