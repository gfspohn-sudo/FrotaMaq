import { describe, it, expect } from 'vitest'
import { Money } from '@/domain/value-objects/Money'

describe('Money', () => {
  it('formata valores em BRL', () => {
    const money = new Money(1234.56)

    expect(money.format('pt-BR', 'BRL')).toMatch(/R\$\s*1\.234,56/)
  })

  it('soma valores corretamente', () => {
    const a = new Money(100.5)
    const b = new Money(200.25)

    expect(a.add(b).value).toBeCloseTo(300.75)
  })

  it('interpreta strings com vírgula decimal', () => {
    expect(Money.from('1.234,50').value).toBeCloseTo(1234.5)
  })

  it('retorna zero para valores inválidos', () => {
    expect(Money.from('').value).toBe(0)
    expect(Money.from(null).value).toBe(0)
    expect(Money.zero().value).toBe(0)
  })

  it('identifica valores positivos', () => {
    expect(new Money(0.01).isPositive()).toBe(true)
    expect(Money.zero().isPositive()).toBe(false)
  })
})
