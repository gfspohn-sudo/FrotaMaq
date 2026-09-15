import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createVeiculo, updateVeiculo } from '@/services/vehicles'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { getEmpresas } from '@/services/empresas'
import type { Veiculo, StatusVeiculo, NovoVeiculo, Empresa } from '@/types/database'
import { STATUS_VEICULO_LABELS } from '@/types/database'

interface VehicleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  veiculo?: Veiculo | null
}

const emptyForm = {
  placa: '',
  modelo: '',
  marca: '',
  ano_modelo: '',
  ano_carroceria: '',
  km_atual: '',
  status: 'em_operacao' as StatusVeiculo,
  foto_url: '',
  empresa_id: '',
}

export function VehicleFormModal({ isOpen, onClose, onSuccess, veiculo }: VehicleFormModalProps) {
  const { profile } = useAuth()
  const { filterEmpresaId, isSuperAdminUser } = useTenant()
  const { isGestor } = usePermissions()
  const isEditing = Boolean(veiculo)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [form, setForm] = useState({ ...emptyForm, empresa_id: '' })

  useEffect(() => {
    if (!isOpen) return

    if (isSuperAdminUser && !isEditing) {
      getEmpresas(profile).then(({ data }) => { if (data) setEmpresas(data) })
    }

    if (veiculo) {
      setForm({
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        marca: veiculo.marca,
        ano_modelo: String(veiculo.ano_modelo ?? veiculo.ano),
        ano_carroceria: veiculo.ano_carroceria ? String(veiculo.ano_carroceria) : '',
        km_atual: String(veiculo.km_atual),
        status: veiculo.status,
        foto_url: veiculo.foto_url ?? '',
        empresa_id: veiculo.empresa_id ?? '',
      })
    } else {
      const defaultEmpresaId = isSuperAdminUser
        ? (filterEmpresaId ?? '')
        : (profile?.empresa_id ?? '')

      setForm({ ...emptyForm, empresa_id: defaultEmpresaId })
    }

    setError('')
  }, [isOpen, veiculo, filterEmpresaId, isSuperAdminUser, isEditing, profile?.empresa_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let empresaId: string | undefined

    if (isSuperAdminUser) {
      empresaId = form.empresa_id || filterEmpresaId || undefined
    } else if (isGestor) {
      empresaId = profile?.empresa_id ?? undefined
    } else {
      empresaId = profile?.empresa_id ?? undefined
    }

    if (!empresaId) {
      setError('Empresa não definida. Selecione uma empresa ou verifique seu perfil.')
      setLoading(false)
      return
    }

    const anoModelo = Number(form.ano_modelo)
    const payload: NovoVeiculo = {
      placa: form.placa.trim().toUpperCase(),
      modelo: form.modelo.trim(),
      marca: form.marca.trim(),
      ano: anoModelo,
      ano_modelo: anoModelo,
      ano_carroceria: form.ano_carroceria ? Number(form.ano_carroceria) : null,
      km_atual: Number(form.km_atual),
      status: form.status,
      foto_url: form.foto_url.trim() || undefined,
      empresa_id: empresaId,
    }

    const result = isEditing && veiculo
      ? await updateVeiculo(veiculo.id, payload)
      : await createVeiculo(payload)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    onSuccess?.()
    onClose()
  }

  const statusOptions = Object.entries(STATUS_VEICULO_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Veículo' : 'Cadastrar Veículo'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSuperAdminUser && !isEditing && empresas.length > 0 && (
          <Select
            label="Empresa (obrigatório)"
            value={form.empresa_id}
            onChange={e => setForm(prev => ({ ...prev, empresa_id: e.target.value }))}
            options={[
              { value: '', label: 'Selecione a empresa destino' },
              ...empresas.map(e => ({ value: e.id, label: e.nome })),
            ]}
            required
          />
        )}

        {isGestor && !isSuperAdminUser && !isEditing && (
          <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
            Veículo será vinculado automaticamente à sua empresa.
          </p>
        )}

        <Input
          label="Placa"
          placeholder="ABC-1D23"
          value={form.placa}
          onChange={e => setForm(prev => ({ ...prev, placa: e.target.value }))}
          required
        />
        <Input
          label="Modelo"
          placeholder="Gol 1.0, Hilux, Sprinter..."
          value={form.modelo}
          onChange={e => setForm(prev => ({ ...prev, modelo: e.target.value }))}
          required
        />
        <Input
          label="Marca"
          placeholder="Volkswagen, Toyota, Mercedes..."
          value={form.marca}
          onChange={e => setForm(prev => ({ ...prev, marca: e.target.value }))}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ano do Modelo"
            type="number"
            min={1900}
            max={2100}
            placeholder="2022"
            value={form.ano_modelo}
            onChange={e => setForm(prev => ({ ...prev, ano_modelo: e.target.value }))}
            required
          />
          <Input
            label="Ano da Carroceria"
            type="number"
            min={1900}
            max={2100}
            placeholder="Opcional"
            value={form.ano_carroceria}
            onChange={e => setForm(prev => ({ ...prev, ano_carroceria: e.target.value }))}
          />
        </div>
        <Input
          label="Quilometragem Atual"
          type="number"
          min={0}
          placeholder="45000"
          value={form.km_atual}
          onChange={e => setForm(prev => ({ ...prev, km_atual: e.target.value }))}
          required
        />
        <Select
          label="Status inicial"
          value={form.status}
          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as StatusVeiculo }))}
          options={statusOptions}
        />
        <Input
          label="URL da foto (opcional)"
          type="url"
          placeholder="https://..."
          value={form.foto_url}
          onChange={e => setForm(prev => ({ ...prev, foto_url: e.target.value }))}
        />

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
