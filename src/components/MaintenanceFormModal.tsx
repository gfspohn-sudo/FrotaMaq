import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createManutencao } from '@/services/maintenance'
import { getVeiculos } from '@/services/vehicles'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import type { TipoManutencao, StatusManutencao, MetodoPagamento, Veiculo } from '@/types/database'
import { TIPO_MANUTENCAO_LABELS, METODO_PAGAMENTO_LABELS } from '@/types/database'

interface MaintenanceFormModalProps {
  isOpen: boolean
  onClose: () => void
  veiculoId?: string
  onSuccess?: () => void
}

export function MaintenanceFormModal({ isOpen, onClose, veiculoId, onSuccess }: MaintenanceFormModalProps) {
  const { filterEmpresaId } = useTenant()
  const { profile } = useAuth()
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    veiculo_id: veiculoId ?? '',
    tipo: 'preventiva' as TipoManutencao,
    descricao: '',
    data_hora: '',
    local: '',
    responsavel: '',
    valor: '',
    metodo_pagamento: '' as MetodoPagamento | '',
    proxima_manutencao_previsao: '',
    proxima_manutencao_data: '',
    proxima_manutencao_km: '',
    status: 'agendada' as StatusManutencao,
  })

  useEffect(() => {
    if (isOpen) {
      getVeiculos({ empresaId: filterEmpresaId }).then(({ data }) => {
        if (data) setVeiculos(data)
      })
      if (veiculoId) setForm(prev => ({ ...prev, veiculo_id: veiculoId }))
    }
  }, [isOpen, veiculoId, filterEmpresaId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const selectedVeiculo = veiculos.find(v => v.id === form.veiculo_id)

    const { error: createError } = await createManutencao({
      veiculo_id: form.veiculo_id,
      empresa_id: selectedVeiculo?.empresa_id ?? profile?.empresa_id ?? undefined,
      tipo: form.tipo,
      descricao: form.descricao,
      data_hora: new Date(form.data_hora).toISOString(),
      local: form.local || undefined,
      responsavel: form.responsavel || undefined,
      valor: form.valor ? parseFloat(form.valor) : 0,
      metodo_pagamento: form.metodo_pagamento || undefined,
      proxima_manutencao_previsao: form.proxima_manutencao_previsao || undefined,
      proxima_manutencao_data: form.proxima_manutencao_data || undefined,
      proxima_manutencao_km: form.proxima_manutencao_km
        ? parseInt(form.proxima_manutencao_km, 10)
        : undefined,
      status: form.status,
    })

    setLoading(false)

    if (createError) {
      setError(createError.message)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Manutenção">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {!veiculoId && (
          <Select
            label="Veículo"
            value={form.veiculo_id}
            onChange={e => setForm(prev => ({ ...prev, veiculo_id: e.target.value }))}
            options={[
              { value: '', label: 'Selecione um veículo' },
              ...veiculos.map(v => ({ value: v.id, label: `${v.modelo} - ${v.placa}` })),
            ]}
            required
          />
        )}

        <Select
          label="Tipo de manutenção"
          value={form.tipo}
          onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value as TipoManutencao }))}
          options={Object.entries(TIPO_MANUTENCAO_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva a manutenção..."
          value={form.descricao}
          onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
          required
        />

        <Input
          label="Data e hora"
          type="datetime-local"
          value={form.data_hora}
          onChange={e => setForm(prev => ({ ...prev, data_hora: e.target.value }))}
          required
        />

        <Input
          label="Local / Oficina"
          placeholder="Oficina, endereço..."
          value={form.local}
          onChange={e => setForm(prev => ({ ...prev, local: e.target.value }))}
        />

        <Input
          label="Responsável (Mecânico / Técnico / Motorista)"
          placeholder="Nome do responsável"
          value={form.responsavel}
          onChange={e => setForm(prev => ({ ...prev, responsavel: e.target.value }))}
        />

        <Input
          label="Valor Total (R$)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={form.valor}
          onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))}
        />

        <Select
          label="Método de pagamento"
          value={form.metodo_pagamento}
          onChange={e => setForm(prev => ({ ...prev, metodo_pagamento: e.target.value as MetodoPagamento }))}
          options={[
            { value: '', label: 'Selecione...' },
            ...Object.entries(METODO_PAGAMENTO_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />

        <Input
          label="Previsão da próxima manutenção"
          placeholder="Ex: Troca de óleo daqui a 10.000 km ou 6 meses"
          value={form.proxima_manutencao_previsao}
          onChange={e => setForm(prev => ({ ...prev, proxima_manutencao_previsao: e.target.value }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Data prevista (próxima)"
            type="date"
            value={form.proxima_manutencao_data}
            onChange={e => setForm(prev => ({ ...prev, proxima_manutencao_data: e.target.value }))}
          />
          <Input
            label="Km previsto (próxima)"
            type="number"
            min="0"
            placeholder="Ex: 50000"
            value={form.proxima_manutencao_km}
            onChange={e => setForm(prev => ({ ...prev, proxima_manutencao_km: e.target.value }))}
          />
        </div>

        <Select
          label="Status"
          value={form.status}
          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as StatusManutencao }))}
          options={[
            { value: 'agendada', label: 'Agendada' },
            { value: 'em_andamento', label: 'Em andamento' },
            { value: 'concluida', label: 'Concluída' },
          ]}
        />

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
