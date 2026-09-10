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
    <div className="bg-navy-900 px-4 pb-5 pt-1">
      <div className="mx-auto max-w-3xl">
        <label className="block space-y-2">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            <Building2 className="h-4 w-4" />
            Seletor de Empresa
          </span>
          <select
            value={selectedEmpresaId}
            onChange={e => setSelectedEmpresaId(e.target.value)}
            disabled={loadingEmpresas}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
          >
            <option value={ALL_EMPRESAS} className="text-gray-900">
              {ALL_EMPRESAS_LABEL}
            </option>
            {empresas.map(e => (
              <option key={e.id} value={e.id} className="text-gray-900">
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
