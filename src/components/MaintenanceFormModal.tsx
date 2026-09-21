import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createManutencao } from '@/services/maintenance'
import { getVeiculos } from '@/services/vehicles'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatErrorMessage } from '@/lib/formatError'
import type { TipoManutencao, Veiculo } from '@/types/database'
import { TIPO_MANUTENCAO_LABELS } from '@/types/database'

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
    valor: '',
  })

  useEffect(() => {
    if (isOpen) {
      getVeiculos({ empresaId: filterEmpresaId }, profile).then(({ data }) => {
        if (data) setVeiculos(data)
      })
      if (veiculoId) setForm(prev => ({ ...prev, veiculo_id: veiculoId }))
    }
  }, [isOpen, veiculoId, filterEmpresaId, profile])

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
      valor: form.valor ? parseFloat(form.valor) : 0,
    }, profile)

    setLoading(false)

    if (createError) {
      setError(formatErrorMessage(createError))
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
              ...veiculos.map(v => ({
                value: v.id,
                label: v.nome_exibicao ?? `${v.modelo ?? ''} - ${v.placa}`.trim(),
              })),
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
          label="Valor Total (R$)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={form.valor}
          onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))}
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
