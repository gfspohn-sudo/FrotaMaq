import { describe, it, expect } from 'vitest'
import { createVeiculo } from '../../helpers/fixtures'

describe('Veiculo', () => {
  it('rejeita quilometragem menor que a atual', () => {
    const veiculo = createVeiculo({ kmAtual: 50_000 })

    const result = veiculo.validarNovaQuilometragem(49_999)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('não pode ser menor')
    }
  })

  it('lança erro ao atualizar quilometragem inválida', () => {
    const veiculo = createVeiculo({ kmAtual: 50_000 })

    expect(() => veiculo.atualizarQuilometragem(40_000)).toThrow(/não pode ser menor/)
  })

  it('atualiza quilometragem quando o valor é maior ou igual', () => {
    const veiculo = createVeiculo({ kmAtual: 50_000 })

    const atualizado = veiculo.atualizarQuilometragem(51_000)

    expect(atualizado.kmAtual.value).toBe(51_000)
    expect(veiculo.kmAtual.value).toBe(50_000)
  })

  it('altera status para em_manutencao ao encaminhar para manutenção', () => {
    const veiculo = createVeiculo({ status: 'em_operacao' })

    const emManutencao = veiculo.encaminharParaManutencao()

    expect(emManutencao.status).toBe('em_manutencao')
    expect(emManutencao.estaEmManutencao()).toBe(true)
    expect(veiculo.status).toBe('em_operacao')
  })

  it('mantém imutabilidade quando já está em manutenção', () => {
    const veiculo = createVeiculo({ status: 'em_manutencao' })

    expect(veiculo.encaminharParaManutencao()).toBe(veiculo)
  })
})
