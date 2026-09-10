/** Value Object — quilometragem / horímetro do veículo. */
export class Quilometragem {
  readonly km: number

  constructor(km: number) {
    this.km = km
  }

  static create(km: number): { ok: true; value: Quilometragem } | { ok: false; message: string } {
    if (!Number.isFinite(km) || km < 0) {
      return { ok: false, message: 'Informe uma quilometragem válida (número ≥ 0).' }
    }
    return { ok: true, value: new Quilometragem(km) }
  }

  static from(km: number): Quilometragem {
    return new Quilometragem(Number.isFinite(km) && km >= 0 ? km : 0)
  }

  get value(): number {
    return this.km
  }

  format(locale = 'pt-BR'): string {
    return `${this.km.toLocaleString(locale)} km`
  }
}
