/** Formato padrão: [Empresa] - [Placa Completa] */
export function formatVehicleDisplayName(empresaNome: string, placa: string): string {
  const placaNormalizada = placa.trim().toUpperCase()
  return `${empresaNome.trim()} - ${placaNormalizada}`
}

export function formatVehicleSubtitle(marca: string, anoModelo: number, anoCarroceria?: number | null): string {
  const anos = anoCarroceria && anoCarroceria !== anoModelo
    ? `Mod. ${anoModelo} · Carc. ${anoCarroceria}`
    : `Ano mod. ${anoModelo}`
  return `${marca} · ${anos}`
}
