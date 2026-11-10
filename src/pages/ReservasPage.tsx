import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, CalendarClock, MapPin, Gauge, History } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { TripRouteMap } from '@/components/TripRouteMap'
import { EsgTripEstimate } from '@/components/EsgTripEstimate'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/contexts/TenantContext'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getReservas, solicitarReserva, aprovarReserva, rejeitarReserva, finalizarViagem } from '@/services/reservas'
import { getVeiculos } from '@/services/vehicles'
import { STATUS_RESERVA_LABELS } from '@/types/database'
import type { AuditLog, Reserva, Veiculo } from '@/types/database'
import { Toast } from '@/components/ui/Toast'
import { describeReservaSubmitError } from '@/lib/formatError'
import { parseKmInput } from '@/utils/esgCalculator'
import { AuditTimeline } from '@/components/AuditTimeline'
import { getAuditLogs } from '@/services/auditLog'

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
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'success' } | null>(null)
  const [kmFinalById, setKmFinalById] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<Reserva | null>(null)
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditLog[]>([])
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [rejectingSaving, setRejectingSaving] = useState(false)
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
    const [reservasRes, veiculosRes, auditRes] = await Promise.all([
      getReservas(profile, { empresaId: filterEmpresaId }),
      canRequestReserva ? getVeiculos({ empresaId: filterEmpresaId }, profile) : Promise.resolve({ data: null }),
      getAuditLogs({ empresaId: filterEmpresaId, limit: 80 }),
    ])
    if (reservasRes.data) setReservas(reservasRes.data)
    setAuditEvents(auditRes.data)
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

    const missing: string[] = []
    if (!form.veiculo_id) missing.push('Veículo')
    if (!form.data_viagem) missing.push('Data da viagem')
    if (!form.destino.trim()) missing.push('Destino')
    const kmIdaVolta = parseKmInput(form.km_ida_volta)
    if (kmIdaVolta <= 0) missing.push('Quilometragem ida e volta')

    if (missing.length > 0) {
      const message = `Preencha os campos obrigatórios: ${missing.join(', ')}.`
      setError(message)
      setToast({ message, variant: 'error' })
      return
    }

    const dataViagem = new Date(form.data_viagem)
    if (Number.isNaN(dataViagem.getTime())) {
      const message = 'Data da viagem inválida.'
      setError(message)
      setToast({ message, variant: 'error' })
      return
    }

    const empresaId = filterEmpresaId ?? profile?.empresa_id
    if (!profile?.id || !empresaId) {
      const message = 'Não foi possível identificar a empresa da viagem. Selecione uma empresa ou entre novamente.'
      setError(message)
      setToast({ message, variant: 'error' })
      return
    }

    setSaving(true)

    const { data, error: submitError } = await solicitarReserva(profile, {
      veiculo_id: form.veiculo_id,
      empresa_id: empresaId,
      data_viagem: dataViagem.toISOString(),
      destino: form.destino.trim(),
      km_ida_volta: kmIdaVolta,
    })

    setSaving(false)

    if (submitError) {
      const message = describeReservaSubmitError(submitError)
      setError(message)
      setToast({ message, variant: 'error' })
      return
    }

    if (data) {
      const message = 'Reserva solicitada com sucesso. Aguardando aprovação do gestor.'
      setFeedback(message)
      setToast({ message, variant: 'success' })
      setForm({ veiculo_id: '', data_viagem: '', destino: '', km_ida_volta: '' })
      load()
    }
  }

  async function handleApprove(id: string) {
    const { error: approveError } = await aprovarReserva(profile, id)
    if (approveError) setError(approveError.message)
    else load()
  }

  async function handleRejectConfirm() {
    if (!rejecting) return
    const motivo = motivoRecusa.trim()
    if (!motivo) {
      setError('Informe o motivo da recusa.')
      return
    }
    setRejectingSaving(true)
    setError('')
    const { error: rejectError } = await rejeitarReserva(profile, rejecting.id, motivo)
    setRejectingSaving(false)
    if (rejectError) {
      setError(rejectError.message)
      return
    }
    setRejecting(null)
    setMotivoRecusa('')
    load()
  }

  async function handleFinish(id: string) {
    const kmFinal = Number(kmFinalById[id])
    const { error: finishError } = await finalizarViagem(profile, id, kmFinal)
    if (finishError) setError(finishError.message)
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

      <div className="page-section">
        {canRequestReserva && (
          <Card>
            <h2 className="mb-4 text-base font-semibold tracking-tight text-fg">Solicitar reserva</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <TripRouteMap
                destino={form.destino}
                kmIdaVolta={form.km_ida_volta}
                onDestinoChange={value => setForm(prev => ({ ...prev, destino: value }))}
                onKmChange={value => setForm(prev => ({ ...prev, km_ida_volta: value }))}
              />
              <EsgTripEstimate
                kmIdaVolta={form.km_ida_volta}
                veiculo={veiculos.find(item => item.id === form.veiculo_id) ?? null}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              {feedback && <p className="text-sm text-success">{feedback}</p>}
              <Button type="submit" className="w-full" loading={saving}>
                {saving ? 'Enviando...' : 'Solicitar reserva'}
              </Button>
            </form>
          </Card>
        )}

        {error && !canRequestReserva && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {canApproveReserva && (
          <p className="text-sm text-fg-muted">Painel de aprovação — reservas pendentes da empresa</p>
        )}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : reservas.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sem viagens este mês"
            description="Nenhuma reserva encontrada. Solicite a primeira viagem para começar a acompanhar a operação."
          />
        ) : (
          <div className="grid gap-4">
            {reservas.map(r => (
              <Card key={r.id} className="transition-all duration-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 space-y-1 text-left"
                    onClick={() => setSelectedReserva(r)}
                  >
                    <p className="font-medium text-fg">
                      {r.veiculos ? `${r.veiculos.modelo} - ${r.veiculos.placa}` : 'Veículo'}
                    </p>
                    <p className="text-sm text-fg-muted flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {r.destino}
                    </p>
                    <p className="text-xs text-fg-muted flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(r.data_viagem).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-fg-muted flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {r.km_ida_volta.toLocaleString('pt-BR')} km (ida/volta)
                    </p>
                    {r.km_inicial != null && (
                      <p className="text-xs text-fg-muted">Km inicial: {r.km_inicial.toLocaleString('pt-BR')}</p>
                    )}
                    {r.km_final != null && (
                      <p className="text-xs text-fg-muted">
                        Km final: {r.km_final.toLocaleString('pt-BR')}
                        {r.km_percorrido != null ? ` · ${r.km_percorrido.toLocaleString('pt-BR')} km percorridos` : ''}
                      </p>
                    )}
                    {r.usuarios?.nome && (
                      <p className="text-xs text-fg-subtle">Motorista: {r.usuarios.nome}</p>
                    )}
                    {r.status === 'REJEITADO' && (r.motivo_recusa || r.observacao_gestor) && (
                      <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                        Motivo da recusa: {r.motivo_recusa || r.observacao_gestor}
                      </p>
                    )}
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-action">
                      <History className="h-3.5 w-3.5" />
                      Ver detalhes e auditoria
                    </p>
                  </button>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.status === 'APROVADO' ? 'bg-success/10 text-success'
                      : r.status === 'REJEITADO' ? 'bg-danger/10 text-danger'
                        : r.status === 'CONCLUIDA' ? 'bg-surface-muted text-fg-muted'
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
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => {
                      setError('')
                      setMotivoRecusa('')
                      setRejecting(r)
                    }}>
                      Recusar
                    </Button>
                  </div>
                )}
                {r.status === 'APROVADO' && (
                  <div className="mt-3 flex items-end gap-2">
                    <Input
                      label="Km final"
                      type="number"
                      min={r.km_inicial ?? 0}
                      value={kmFinalById[r.id] ?? ''}
                      onChange={e => setKmFinalById(prev => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => handleFinish(r.id)}>
                      Finalizar viagem
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      <Modal
        isOpen={!!selectedReserva}
        onClose={() => setSelectedReserva(null)}
        title="Detalhes da reserva"
      >
        {selectedReserva && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-fg">
                {selectedReserva.veiculos
                  ? `${selectedReserva.veiculos.modelo} · ${selectedReserva.veiculos.placa}`
                  : 'Veículo'}
              </p>
              <p className="mt-1 text-sm text-fg-muted">{selectedReserva.destino}</p>
              <p className="text-xs text-fg-muted">
                {new Date(selectedReserva.data_viagem).toLocaleString('pt-BR')}
                {' · '}
                {STATUS_RESERVA_LABELS[selectedReserva.status]}
              </p>
            </div>
            <AuditTimeline
              events={auditEvents.filter(event => event.reserva_id === selectedReserva.id)}
              title="Histórico recente"
              emptyDescription="Ainda não há eventos de auditoria nesta viagem."
            />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!rejecting}
        onClose={() => {
          if (!rejectingSaving) {
            setRejecting(null)
            setMotivoRecusa('')
          }
        }}
        title="Recusar reserva"
      >
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Informe o motivo da recusa. O motorista poderá consultar esta justificativa.
          </p>
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Textarea
              label="Informe o motivo da recusa:"
              value={motivoRecusa}
              onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex.: veículo indisponível na data, conflito de agenda..."
              error={error && !motivoRecusa.trim() ? error : undefined}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={rejectingSaving}
              onClick={() => {
                setRejecting(null)
                setMotivoRecusa('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              loading={rejectingSaving}
              disabled={!motivoRecusa.trim()}
              onClick={handleRejectConfirm}
            >
              {rejectingSaving ? 'Recusando...' : 'Confirmar recusa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
