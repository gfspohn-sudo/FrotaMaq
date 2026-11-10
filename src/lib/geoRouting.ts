export interface GeoPoint {
  lat: number
  lon: number
  label: string
}

export interface RouteResult {
  distanceKmOneWay: number
  distanceKmRoundTrip: number
  coordinates: [number, number][]
  source: 'osrm' | 'haversine'
}

export class SamePointError extends Error {
  constructor() {
    super('Origem e destino são o mesmo ponto. Escolha um destino diferente para calcular a rota.')
    this.name = 'SamePointError'
  }
}

/** Identificação exigida pelo Nominatim. No browser o Vite injeta este header no proxy. */
export const GEO_USER_AGENT = 'FrotaMaq/1.0 (https://frotamaq.app; suporte@frotamaq.app)'

const NOMINATIM_DIRECT_URL = 'https://nominatim.openstreetmap.org/search'
const PHOTON_URL = 'https://photon.komoot.io/api/'
const OSRM_DIRECT_URL = 'https://router.project-osrm.org/route/v1/driving'
const EARTH_RADIUS_KM = 6371
const SAME_POINT_KM = 0.05

export function isValidCoord(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) return false
  return Number.isFinite(point.lat)
    && Number.isFinite(point.lon)
    && point.lat >= -90 && point.lat <= 90
    && point.lon >= -180 && point.lon <= 180
}

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

export function haversineKm(origin: GeoPoint, destination: GeoPoint): number {
  const dLat = toRad(destination.lat - origin.lat)
  const dLon = toRad(destination.lon - origin.lon)
  const lat1 = toRad(origin.lat)
  const lat2 = toRad(destination.lat)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function isSamePoint(origin: GeoPoint, destination: GeoPoint): boolean {
  if (!isValidCoord(origin) || !isValidCoord(destination)) return false
  return haversineKm(origin, destination) < SAME_POINT_KM
}

/** Distância de ida e volta a partir de um trecho em km. */
export function computeRoundTripKm(distanciaUmTrecho: number): number {
  if (!Number.isFinite(distanciaUmTrecho) || distanciaUmTrecho <= 0) return 0
  const distanciaTotal = distanciaUmTrecho * 2
  return Math.max(1, Math.round(distanciaTotal))
}

export function metersToRoundTripKm(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  return computeRoundTripKm(meters / 1000)
}

function usesDevGeoProxy(): boolean {
  return Boolean(import.meta.env.DEV && typeof window !== 'undefined')
}

export function nominatimSearchUrl(): string {
  return usesDevGeoProxy() ? '/geo/nominatim/search' : NOMINATIM_DIRECT_URL
}

export function osrmRouteUrl(origin: GeoPoint, destination: GeoPoint): string {
  const path = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`
  return usesDevGeoProxy()
    ? `/geo/osrm/route/v1/driving/${path}`
    : `${OSRM_DIRECT_URL}/${path}`
}

export function buildNominatimHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  }

  // User-Agent no browser dispara preflight CORS e o Nominatim recusa OPTIONS.
  // No Node/testes enviamos o header; no Vite o proxy injeta o mesmo valor.
  if (typeof window === 'undefined') {
    headers['User-Agent'] = GEO_USER_AGENT
  }

  return headers
}

export function parseNominatimResults(payload: unknown): GeoPoint[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map(item => {
      const row = item as { lat?: string; lon?: string; display_name?: string }
      const lat = Number(row.lat)
      const lon = Number(row.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !row.display_name) return null
      return { lat, lon, label: row.display_name }
    })
    .filter((item): item is GeoPoint => item != null)
}

export function parsePhotonResults(payload: unknown): GeoPoint[] {
  const features = (payload as { features?: unknown[] } | null)?.features
  if (!Array.isArray(features)) return []

  return features
    .map(item => {
      const feature = item as {
        geometry?: { coordinates?: number[] }
        properties?: { name?: string; city?: string; state?: string; country?: string; street?: string }
      }
      const [lon, lat] = feature.geometry?.coordinates ?? []
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      const props = feature.properties ?? {}
      const label = [props.name, props.street, props.city, props.state, props.country]
        .filter(Boolean)
        .join(', ')
      if (!label) return null
      return { lat: Number(lat), lon: Number(lon), label }
    })
    .filter((item): item is GeoPoint => item != null)
}

async function searchNominatim(query: string, signal?: AbortSignal): Promise<GeoPoint[]> {
  const url = new URL(nominatimSearchUrl(), typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '0')
  url.searchParams.set('email', 'suporte@frotamaq.app')

  const response = await fetch(url.toString(), {
    signal,
    headers: buildNominatimHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Nominatim HTTP ${response.status}`)
  }

  return parseNominatimResults(await response.json())
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<GeoPoint[]> {
  const url = new URL(PHOTON_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'pt')

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`)
  return parsePhotonResults(await response.json())
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoPoint[]> {
  const q = query.trim()
  if (q.length < 3) return []

  try {
    const nominatim = await searchNominatim(q, signal)
    if (nominatim.length > 0) {
      console.log('[Geo] Nominatim resultados:', nominatim.map(p => ({ label: p.label, lat: p.lat, lon: p.lon })))
      return nominatim
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    console.warn('[Geo] Nominatim falhou, tentando Photon:', error)
  }

  const photon = await searchPhoton(q, signal)
  console.log('[Geo] Photon resultados:', photon.map(p => ({ label: p.label, lat: p.lat, lon: p.lon })))
  return photon
}

export async function resolvePlace(query: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const results = await searchPlaces(query, signal)
  return results[0] ?? null
}

function parseOsrmDistanceMeters(payload: unknown): { meters: number; coordinates: [number, number][] } {
  const data = payload as {
    code?: string
    routes?: { distance?: number | string; geometry?: { coordinates?: [number, number][] } }[]
  }
  const route = data.routes?.[0]
  const meters = Number(route?.distance)
  const coordinates = (route?.geometry?.coordinates ?? []).map(
    ([lon, lat]) => [lat, lon] as [number, number],
  )
  return { meters: Number.isFinite(meters) ? meters : 0, coordinates }
}

function routeFromStraightLine(origin: GeoPoint, destination: GeoPoint): RouteResult {
  const distanciaUmTrecho = haversineKm(origin, destination)
  if (distanciaUmTrecho <= 0) throw new SamePointError()
  return {
    distanceKmOneWay: Math.max(1, Math.round(distanciaUmTrecho)),
    distanceKmRoundTrip: computeRoundTripKm(distanciaUmTrecho),
    coordinates: [
      [origin.lat, origin.lon],
      [destination.lat, destination.lon],
    ],
    source: 'haversine',
  }
}

function logRoute(origin: GeoPoint, destination: GeoPoint, result: RouteResult) {
  console.log('[Geo] coordenadas capturadas', {
    origem: { lat: origin.lat, lon: origin.lon, label: origin.label },
    destino: { lat: destination.lat, lon: destination.lon, label: destination.label },
  })
  console.log('[Geo] distância calculada em km', {
    ida: result.distanceKmOneWay,
    idaVolta: result.distanceKmRoundTrip,
    fonte: result.source,
  })
}

export async function fetchDrivingRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (!isValidCoord(origin) || !isValidCoord(destination)) {
    throw new Error('Coordenadas de origem ou destino inválidas.')
  }
  if (isSamePoint(origin, destination)) {
    throw new SamePointError()
  }

  try {
    const response = await fetch(osrmRouteUrl(origin, destination), {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`)

    const { meters, coordinates } = parseOsrmDistanceMeters(await response.json())
    if (meters > 0) {
      const distanciaUmTrecho = meters / 1000
      const result: RouteResult = {
        distanceKmOneWay: Math.max(1, Math.round(distanciaUmTrecho)),
        distanceKmRoundTrip: computeRoundTripKm(distanciaUmTrecho),
        coordinates: coordinates.length >= 2
          ? coordinates
          : [[origin.lat, origin.lon], [destination.lat, destination.lon]],
        source: 'osrm',
      }
      logRoute(origin, destination, result)
      return result
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    console.warn('[Geo] OSRM indisponível, usando Haversine:', error)
  }

  const fallback = routeFromStraightLine(origin, destination)
  logRoute(origin, destination, fallback)
  return fallback
}
