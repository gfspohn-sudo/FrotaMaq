import { useCallback, useEffect, useState } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import {
  getEmpresas,
  criarEmpresa,
  excluirEmpresa,
  getEmpresaDependencies,
  EmpresaDomainService,
} from '@/services/empresas'
import type { Empresa } from '@/types/database'
import type { EmpresaDependencies } from '@/domain/repositories/IEmpresaRepository'

const emptyForm = { nome: '', cnpj: '', slug: '' }

export function EmpresasPage() {
  const { profile } = useAuth()
  const { canCreateEmpresa, canDeleteEmpresa } = usePermissions()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null)
  const [dependencies, setDependencies] = useState<EmpresaDependencies | null>(null)
  const [loadingDeps, setLoadingDeps] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadEmpresas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await getEmpresas(profile)
    if (data) setEmpresas(data)
    if (error) setFeedback(error.message)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadEmpresas()
  }, [loadEmpresas])

  function handleNomeChange(nome: string) {
    setForm(prev => ({
      ...prev,
      nome,
      slug: prev.slug || EmpresaDomainService.slugify(nome),
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFeedback('')
    setSaving(true)

    const { data, error } = await criarEmpresa(
      {
        nome: form.nome,
        cnpj: form.cnpj || null,
        slug: form.slug,
      },
      profile,
    )

    setSaving(false)

    if (error) {
      setFeedback(error.message)
      return
    }

    if (data) {
      setEmpresas(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setShowCreate(false)
      setForm(emptyForm)
      setFeedback(`Empresa "${data.nome}" criada com sucesso.`)
    }
  }

  async function openDeleteModal(empresa: Empresa) {
    setDeleteTarget(empresa)
    setDependencies(null)
    setLoadingDeps(true)

    const { data, error } = await getEmpresaDependencies(empresa.id, profile)
    setLoadingDeps(false)

    if (error) {
      setFeedback(error.message)
      setDeleteTarget(null)
      return
    }

    setDependencies(data)
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    setFeedback('')

    const { error, deleted } = await excluirEmpresa(deleteTarget.id, profile)
    setDeleting(false)

    if (error) {
      setFeedback(error.message)
      return
    }

    if (deleted) {
      setEmpresas(prev => prev.filter(e => e.id !== deleteTarget.id))
      setFeedback(`Empresa "${deleteTarget.nome}" excluída.`)
      setDeleteTarget(null)
      setDependencies(null)
    }
  }

  const hasDependencies = dependencies
    ? dependencies.usuarios + dependencies.veiculos + dependencies.manutencoes > 0
    : false

  return (
    <div>
      <Header title="Empresas" />

      <div className="space-y-4 px-4 py-4">
        {canCreateEmpresa && (
          <Button className="w-full" onClick={() => { setShowCreate(true); setFeedback('') }}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Empresa
          </Button>
        )}

        {feedback && (
          <p className="rounded-lg bg-action/10 px-3 py-2 text-sm text-action">{feedback}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : empresas.length === 0 ? (
          <Card className="py-8 text-center text-sm text-gray-500">
            Nenhuma empresa cadastrada.
          </Card>
        ) : (
          <div className="space-y-2">
            {empresas.map(empresa => (
              <Card key={empresa.id} className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action/10 text-action">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{empresa.nome}</p>
                    <p className="text-xs text-gray-500">Slug: {empresa.slug}</p>
                    {empresa.cnpj && (
                      <p className="text-xs text-gray-500">CNPJ: {empresa.cnpj}</p>
                    )}
                  </div>
                </div>
                {canDeleteEmpresa && (
                  <button
                    type="button"
                    onClick={() => openDeleteModal(empresa)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-danger"
                    aria-label={`Excluir ${empresa.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nova Empresa">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nome"
            value={form.nome}
            onChange={e => handleNomeChange(e.target.value)}
            required
          />
          <Input
            label="CNPJ"
            value={form.cnpj}
            onChange={e => setForm(prev => ({ ...prev, cnpj: e.target.value }))}
            placeholder="00.000.000/0000-00"
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            required
            placeholder="minha-empresa"
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { setDeleteTarget(null); setDependencies(null) }}
        title="Excluir empresa"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Deseja excluir a empresa <strong>{deleteTarget.nome}</strong>?
            </p>

            {loadingDeps ? (
              <p className="text-sm text-gray-500">Verificando vínculos...</p>
            ) : dependencies && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">Vínculos encontrados:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  <li>{dependencies.usuarios} usuário(s) — terão empresa desvinculada</li>
                  <li>{dependencies.veiculos} veículo(s) — serão excluídos em cascata</li>
                  <li>{dependencies.manutencoes} manutenção(ões) — serão excluídas em cascata</li>
                </ul>
                {hasDependencies && (
                  <p className="mt-2 text-xs text-warning">
                    Esta ação é irreversível. Veículos e manutenções vinculados serão removidos permanentemente.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDependencies(null) }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-danger hover:bg-danger/90"
                disabled={deleting || loadingDeps}
                onClick={confirmDelete}
              >
                {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
