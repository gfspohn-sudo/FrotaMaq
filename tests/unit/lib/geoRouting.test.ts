import { describe, expect, it } from 'vitest'
import {
  SamePointError,
  buildNominatimHeaders,
  computeRoundTripKm,
  fetchDrivingRoute,
  haversineKm,
  isSamePoint,
  isValidCoord,
  metersToRoundTripKm,
  parseNominatimResults,
  parsePhotonResults,
} from '@/lib/geoRouting'

const saoPaulo = { lat: -23.5505, lon: -46.6333, label: 'São Paulo' }
const campinas = { lat: -22.9056, lon: -47.0608, label: 'Campinas' }

describe('geoRouting', () => {
  it('converte um trecho em km de ida e volta', () => {
    expect(computeRoundTripKm(120)).toBe(240)
    expect(metersToRoundTripKm(120_000)).toBe(240)
    expect(metersToRoundTripKm(400)).toBe(1)
    expect(computeRoundTripKm(0)).toBe(0)
  })

  it('valida coordenadas e detecta o mesmo ponto', () => {
    expect(isValidCoord(saoPaulo)).toBe(true)
    expect(isValidCoord({ lat: 200, lon: 0, label: 'x' })).toBe(false)
    expect(isSamePoint(saoPaulo, { ...saoPaulo, label: 'Mesmo' })).toBe(true)
    expect(isSamePoint(saoPaulo, campinas)).toBe(false)
  })

  it('calcula Haversine com valor real em km', () => {
    const km = haversineKm(saoPaulo, campinas)
    expect(km).toBeGreaterThan(70)
    expect(km).toBeLessThan(120)
    expect(computeRoundTripKm(km)).toBeGreaterThan(140)
  })

  it('recusa origem e destino iguais antes de calcular', async () => {
    await expect(fetchDrivingRoute(saoPaulo, { ...saoPaulo, label: 'SP' })).rejects.toBeInstanceOf(SamePointError)
  })

  it('normaliza resultados do Nominatim', () => {
    const points = parseNominatimResults([
      { lat: '-23.55', lon: '-46.63', display_name: 'São Paulo' },
      { lat: 'x', lon: '-46.63', display_name: 'Inválido' },
    ])
    expect(points).toEqual([{ lat: -23.55, lon: -46.63, label: 'São Paulo' }])
  })

  it('normaliza resultados do Photon (fallback CORS)', () => {
    const points = parsePhotonResults({
      features: [
        {
          geometry: { coordinates: [-46.63, -23.55] },
          properties: { name: 'São Paulo', country: 'Brasil' },
        },
      ],
    })
    expect(points).toEqual([{ lat: -23.55, lon: -46.63, label: 'São Paulo, Brasil' }])
  })

  it('envia User-Agent no Nominatim fora do browser', () => {
    const headers = buildNominatimHeaders() as Record<string, string>
    expect(headers['User-Agent']).toMatch(/FrotaMaq/)
    expect(headers.Accept).toBe('application/json')
  })
})
