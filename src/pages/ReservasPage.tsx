import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, MapPin, Gauge } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/contexts/TenantContext'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getReservas, solicitarReserva, aprovarReserva, rejeitarReserva } from '@/services/reservas'
import { getVeiculos } from '@/services/vehicles'
import { STATUS_RESERVA_LABELS } from '@/types/database'
import type { Reserva, Veiculo } from '@/types/database'

export function ReservasPage() {
  const { profile } = useAuth()
  const { canRequestReserva, canApproveReserva } = usePermissions()
  const { filterEmpresaId } = useTenant()
  const [searchParams] = useSearchParams()
  const preselectedVeiculo = searchParams.get('veiculoId') ?? ''
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    veiculo_id: preselectedVeiculo,
    data_viagem: '',
    destino: '',
    km_ida_volta: '',
  })

  useEffect(() => {
    if (preselectedVeiculo) {
      setForm(prev => ({ ...prev, veiculo_id: preselectedVeiculo }))
    }
  }, [preselectedVeiculo])

  const load = useCallback(async () => {
    setLoading(true)
    const [reservasRes, veiculosRes] = await Promise.all([
      getReservas(profile, { empresaId: filterEmpresaId }),
      canRequestReserva ? getVeiculos({ empresaId: filterEmpresaId }, profile) : Promise.resolve({ data: null }),
    ])
    if (reservasRes.data) setReservas(reservasRes.data)
    if (veiculosRes.data) {
      setVeiculos(veiculosRes.data)
      setForm(prev => {
        if (prev.veiculo_id && !veiculosRes.data!.some(v => v.id === prev.veiculo_id)) {
          setError('Veículo selecionado está indisponível para reserva.')
          return { ...prev, veiculo_id: '' }
        }
        return prev
      })
    }
    setLoading(false)
  }, [profile, filterEmpresaId, canRequestReserva])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFeedback('')
    setSaving(true)

    const { data, error: submitError } = await solicitarReserva(profile, {
      veiculo_id: form.veiculo_id,
      data_viagem: new Date(form.data_viagem).toISOString(),
      destino: form.destino.trim(),
      km_ida_volta: Number(form.km_ida_volta),
    })

    setSaving(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    if (data) {
      setFeedback('Reserva solicitada com sucesso. Aguardando aprovação do gestor.')
      setForm({ veiculo_id: '', data_viagem: '', destino: '', km_ida_volta: '' })
      load()
    }
  }

  async function handleApprove(id: string) {
    const { error: approveError } = await aprovarReserva(profile, id)
    if (approveError) setError(approveError.message)
    else load()
  }

  async function handleReject(id: string) {
    const { error: rejectError } = await rejeitarReserva(profile, id)
    if (rejectError) setError(rejectError.message)
    else load()
  }

  const veiculoOptions = [
    { value: '', label: 'Selecione o veículo' },
    ...veiculos.map(v => ({
      value: v.id,
      label: v.empresas?.nome
        ? `${v.empresas.nome} - ${v.placa}`
        : `${v.nome_exibicao ?? v.modelo ?? 'Veículo'} - ${v.placa}`,
    })),
  ]

  return (
    <div>
      <Header title="Reservas" />

      <div className="space-y-4 px-4 py-4">
        {canRequestReserva && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Solicitar reserva</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Select
                label="Veículo"
                value={form.veiculo_id}
                onChange={e => setForm(prev => ({ ...prev, veiculo_id: e.target.value }))}
                options={veiculoOptions}
                required
              />
              <Input
                label="Data da viagem"
                type="datetime-local"
                value={form.data_viagem}
                onChange={e => setForm(prev => ({ ...prev, data_viagem: e.target.value }))}
                required
              />
              <Input
                label="Destino"
                value={form.destino}
                onChange={e => setForm(prev => ({ ...prev, destino: e.target.value }))}
                placeholder="Cidade, cliente ou rota"
                required
              />
              <Input
                label="Quilometragem total (ida e volta)"
                type="number"
                min={1}
                value={form.km_ida_volta}
                onChange={e => setForm(prev => ({ ...prev, km_ida_volta: e.target.value }))}
                required
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              {feedback && <p className="text-sm text-success">{feedback}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Enviando...' : 'Solicitar reserva'}
              </Button>
            </form>
          </Card>
        )}

        {canApproveReserva && (
          <p className="text-sm text-gray-600">Painel de aprovação — reservas pendentes da empresa</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : reservas.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-gray-500">Nenhuma reserva encontrada.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {reservas.map(r => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">
                      {r.veiculos ? `${r.veiculos.modelo} - ${r.veiculos.placa}` : 'Veículo'}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {r.destino}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(r.data_viagem).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {r.km_ida_volta.toLocaleString('pt-BR')} km (ida/volta)
                    </p>
                    {r.usuarios?.nome && (
                      <p className="text-xs text-gray-400">Motorista: {r.usuarios.nome}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.status === 'APROVADO' ? 'bg-success/10 text-success'
                      : r.status === 'REJEITADO' ? 'bg-danger/10 text-danger'
                        : 'bg-warning/10 text-warning'
                  }`}>
                    {STATUS_RESERVA_LABELS[r.status]}
                  </span>
                </div>
                {canApproveReserva && r.status === 'PENDENTE' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleApprove(r.id)}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => handleReject(r.id)}>
                      Rejeitar
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
