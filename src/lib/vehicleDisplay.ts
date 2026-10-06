/** Formato padrão: [Empresa] - [Placa Completa] */
export function formatVehicleDisplayName(empresaNome: string, placa: string): string {
  const placaNormalizada = placa.trim().toUpperCase()
  return `${empresaNome.trim()} - ${placaNormalizada}`
}

export function formatPlacaCurta(placa: string): string {
  const digits = placa.replace(/[^A-Za-z0-9]/g, '')
  return digits.slice(-4).toUpperCase() || placa.trim().toUpperCase()
}

export function formatVehicleSubtitle(marca: string, anoModelo: number, anoCarroceria?: number | null): string {
  const anos = anoCarroceria && anoCarroceria !== anoModelo
    ? `Mod. ${anoModelo} · Carc. ${anoCarroceria}`
    : `Ano mod. ${anoModelo}`
  return `${marca} · ${anos}`
}
