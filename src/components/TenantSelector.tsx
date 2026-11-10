import { Building2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { ALL_EMPRESAS, ALL_EMPRESAS_LABEL } from '@/lib/tenantFilter'

export function TenantSelector() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    isSuperAdminUser,
    loadingEmpresas,
  } = useTenant()

  if (!isSuperAdminUser) return null

  return (
    <div className="px-4 pb-2 lg:px-8">
      <label className="block space-y-2">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
          <Building2 className="h-4 w-4" />
          Seletor de Empresa
        </span>
        <select
          value={selectedEmpresaId}
          onChange={e => setSelectedEmpresaId(e.target.value)}
          disabled={loadingEmpresas}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-fg focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20 disabled:opacity-50"
        >
          <option value={ALL_EMPRESAS}>{ALL_EMPRESAS_LABEL}</option>
          {empresas.map(e => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
