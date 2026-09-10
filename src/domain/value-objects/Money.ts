/** Value Object — valor monetário de manutenção. */
export class Money {
  readonly amount: number

  constructor(amount: number) {
    this.amount = amount
  }

  static from(value: unknown): Money {
    if (value == null || value === '') return new Money(0)
    if (typeof value === 'number') {
      return new Money(Number.isFinite(value) ? value : 0)
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return new Money(0)
      const normalized = trimmed.includes(',')
        ? parseFloat(trimmed.replace(/\./g, '').replace(',', '.'))
        : parseFloat(trimmed)
      return new Money(Number.isFinite(normalized) ? normalized : 0)
    }
    return new Money(0)
  }

  static zero(): Money {
    return new Money(0)
  }

  get value(): number {
    return this.amount
  }

  isPositive(): boolean {
    return this.amount > 0
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount)
  }

  format(locale = 'pt-BR', currency = 'BRL'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(this.amount)
  }
}
