import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import { LocateFixed, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  SamePointError,
  fetchDrivingRoute,
  isSamePoint,
  isValidCoord,
  resolvePlace,
  searchPlaces,
  type GeoPoint,
} from '@/lib/geoRouting'

interface TripRouteMapProps {
  destino: string
  kmIdaVolta: string
  onDestinoChange: (destino: string) => void
  onKmChange: (kmIdaVolta: string) => void
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [28, 28] })
      return
    }
    if (points.length === 1) map.setView(points[0], 12)
  }, [map, points])
  return null
}

function PlaceSearch({
  label,
  placeholder,
  value,
  required = false,
  onQueryChange,
  onSelect,
}: {
  label: string
  placeholder: string
  value: string
  required?: boolean
  onQueryChange: (value: string) => void
  onSelect: (place: GeoPoint) => void
}) {
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchPlaces(q, controller.signal)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

  return (
    <div className="relative">
      <Input
        label={label}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        onChange={e => onQueryChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {searching && (
        <Spinner className="absolute right-3 top-10 h-4 w-4 text-fg-subtle" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {suggestions.map(place => (
            <li key={`${place.lat}-${place.lon}-${place.label}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-fg hover:bg-surface-muted"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onSelect(place)
                  setOpen(false)
                  setSuggestions([])
                }}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-action" />
                <span>{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TripRouteMap({ destino, kmIdaVolta, onDestinoChange, onKmChange }: TripRouteMapProps) {
  const [origemLabel, setOrigemLabel] = useState('')
  const [origin, setOrigin] = useState<GeoPoint | null>(null)
  const [destination, setDestination] = useState<GeoPoint | null>(null)
  const [routePoints, setRoutePoints] = useState<[number, number][]>([])
  const [oneWayKm, setOneWayKm] = useState<number | null>(null)
  const [roundTripKm, setRoundTripKm] = useState<number | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [locating, setLocating] = useState(false)
  const routeRequest = useRef(0)
  const onKmChangeRef = useRef(onKmChange)
  onKmChangeRef.current = onKmChange

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        if (!isValidCoord(origin) && origemLabel.trim().length >= 3) {
          const resolved = await resolvePlace(origemLabel, controller.signal)
          if (resolved) setOrigin(resolved)
        }
        if (!isValidCoord(destination) && destino.trim().length >= 3) {
          const resolved = await resolvePlace(destino, controller.signal)
          if (resolved) setDestination(resolved)
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setRouteError('Não foi possível localizar origem ou destino no mapa.')
        }
      }
    }, 700)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [origemLabel, destino, origin, destination])

  useEffect(() => {
    if (!isValidCoord(origin) || !isValidCoord(destination)) {
      setRoutePoints([])
      setOneWayKm(null)
      setRoundTripKm(null)
      return
    }

    if (isSamePoint(origin, destination)) {
      setRoutePoints([])
      setOneWayKm(null)
      setRoundTripKm(null)
      onKmChangeRef.current('')
      setRouteError('Origem e destino são o mesmo ponto. Escolha um destino diferente para calcular a rota.')
      return
    }

    const controller = new AbortController()
    const requestId = ++routeRequest.current
    setRouting(true)
    setRouteError('')

    fetchDrivingRoute(origin, destination, controller.signal)
      .then(result => {
        if (requestId !== routeRequest.current) return
        const distanciaUmTrecho = result.distanceKmOneWay
        const distanciaTotal = result.distanceKmRoundTrip
        setRoutePoints(result.coordinates)
        setOneWayKm(distanciaUmTrecho)
        setRoundTripKm(distanciaTotal)
        onKmChangeRef.current(String(distanciaTotal))
        console.log('[Geo] km_ida_volta atualizado no formulário', distanciaTotal)
      })
      .catch(error => {
        if ((error as Error).name === 'AbortError') return
        setRoutePoints([])
        setOneWayKm(null)
        setRoundTripKm(null)
        onKmChangeRef.current('')
        setRouteError(error instanceof SamePointError
          ? error.message
          : error instanceof Error ? error.message : 'Falha ao calcular a rota.')
      })
      .finally(() => {
        if (requestId === routeRequest.current) setRouting(false)
      })

    return () => controller.abort()
  }, [origin, destination])

  function useMyLocation() {
    if (!navigator.geolocation) {
      setRouteError('Geolocalização não disponível neste navegador.')
      return
    }
    setLocating(true)
    setRouteError('')
    navigator.geolocation.getCurrentPosition(
      position => {
        const point: GeoPoint = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'Minha localização',
        }
        if (!isValidCoord(point)) {
          setLocating(false)
          setRouteError('Coordenadas da sua localização são inválidas.')
          return
        }
        setOrigin(point)
        setOrigemLabel(point.label)
        setLocating(false)
      },
      () => {
        setLocating(false)
        setRouteError('Não foi possível obter a sua localização.')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const previewPoints: [number, number][] = [
    ...(isValidCoord(origin) ? [[origin.lat, origin.lon] as [number, number]] : []),
    ...(isValidCoord(destination) ? [[destination.lat, destination.lon] as [number, number]] : []),
  ]
  const samePoint = isValidCoord(origin) && isValidCoord(destination) && isSamePoint(origin, destination)
  const displayedRoundTrip = roundTripKm ?? (kmIdaVolta ? Number(kmIdaVolta) : null)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <PlaceSearch
          label="Origem"
          placeholder="Base, cidade ou endereço de partida"
          value={origemLabel}
          onQueryChange={value => {
            setOrigemLabel(value)
            setOrigin(null)
          }}
          onSelect={place => {
            setOrigin(place)
            setOrigemLabel(place.label)
          }}
        />
        <Button type="button" variant="secondary" onClick={useMyLocation} loading={locating}>
          <LocateFixed className="h-4 w-4" />
          Minha localização
        </Button>
      </div>

      <PlaceSearch
        label="Destino"
        placeholder="Cidade, cliente ou endereço de chegada"
        required
        value={destino}
        onQueryChange={value => {
          onDestinoChange(value)
          setDestination(null)
        }}
        onSelect={place => {
          setDestination(place)
          onDestinoChange(place.label)
        }}
      />

      <div className="overflow-hidden rounded-xl border border-border">
        <MapContainer
          center={previewPoints[0] ?? DEFAULT_CENTER}
          zoom={6}
          scrollWheelZoom
          className="z-0 h-56 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitRoute points={routePoints.length > 1 ? routePoints : previewPoints} />
          {isValidCoord(origin) && (
            <CircleMarker center={[origin.lat, origin.lon]} radius={8} pathOptions={{ color: '#2563eb', fillOpacity: 0.9 }} />
          )}
          {isValidCoord(destination) && (
            <CircleMarker center={[destination.lat, destination.lon]} radius={8} pathOptions={{ color: '#059669', fillOpacity: 0.9 }} />
          )}
          {routePoints.length > 1 && (
            <Polyline positions={routePoints} pathOptions={{ color: '#2563eb', weight: 4 }} />
          )}
        </MapContainer>
      </div>

      <Input
        label="Quilometragem total (ida e volta)"
        type="number"
        min={1}
        value={kmIdaVolta}
        onChange={e => onKmChange(e.target.value)}
        required
      />

      {samePoint && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Origem e destino são o mesmo ponto. Escolha um destino diferente para evitar o resultado 0 km.
        </p>
      )}

      <p className="text-xs text-fg-muted">
        {routing
          ? 'Calculando rota no OpenStreetMap…'
          : oneWayKm && displayedRoundTrip
            ? `Rota calculada: ${oneWayKm.toLocaleString('pt-BR')} km (ida) · ${displayedRoundTrip.toLocaleString('pt-BR')} km ida e volta. Você pode ajustar o valor se necessário.`
            : 'Selecione origem e destino no mapa para preencher a quilometragem automaticamente.'}
      </p>
      {routeError && !samePoint && <p className="text-xs text-danger">{routeError}</p>}
    </div>
  )
}
