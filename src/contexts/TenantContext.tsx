import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getEmpresas } from '@/services/empresas'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { ALL_EMPRESAS, TENANT_STORAGE_KEY, isSuperAdmin } from '@/lib/tenantFilter'
import type { Empresa } from '@/types/database'

interface TenantContextType {
  empresas: Empresa[]
  selectedEmpresaId: string
  filterEmpresaId: string | undefined
  isViewingAll: boolean
  isSuperAdminUser: boolean
  loadingEmpresas: boolean
  setSelectedEmpresaId: (id: string) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const superAdmin = isSuperAdmin(profile?.perfil)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)
  const [selectedEmpresaId, setSelectedEmpresaIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return ALL_EMPRESAS
    return localStorage.getItem(TENANT_STORAGE_KEY) ?? ALL_EMPRESAS
  })

  useEffect(() => {
    setEmpresas([])
    if (!superAdmin) {
      setSelectedEmpresaIdState(profile?.empresa_id ?? ALL_EMPRESAS)
      return
    }

    async function load() {
      setLoadingEmpresas(true)
      const { data } = await getEmpresas(profile)
      if (data) setEmpresas(data)
      setLoadingEmpresas(false)
    }

    load()
  }, [superAdmin, profile?.id, profile?.empresa_id])

  const setSelectedEmpresaId = useCallback((id: string) => {
    setSelectedEmpresaIdState(id)
    localStorage.setItem(TENANT_STORAGE_KEY, id)
    notifyDataRefresh()
  }, [])

  const filterEmpresaId = useMemo(() => {
    if (superAdmin) {
      return selectedEmpresaId === ALL_EMPRESAS ? undefined : selectedEmpresaId
    }
    return profile?.empresa_id ?? undefined
  }, [superAdmin, selectedEmpresaId, profile?.empresa_id])

  const value = useMemo(
    () => ({
      empresas,
      selectedEmpresaId: superAdmin ? selectedEmpresaId : (profile?.empresa_id ?? ''),
      filterEmpresaId,
      isViewingAll: superAdmin && selectedEmpresaId === ALL_EMPRESAS,
      isSuperAdminUser: superAdmin,
      loadingEmpresas,
      setSelectedEmpresaId,
    }),
    [
      empresas,
      superAdmin,
      selectedEmpresaId,
      profile?.empresa_id,
      filterEmpresaId,
      loadingEmpresas,
      setSelectedEmpresaId,
    ],
  )

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant deve ser usado dentro de TenantProvider')
  return context
}

/** Retorna filterEmpresaId fora do provider (ex.: login) sem quebrar. */
export function useTenantFilter(): string | undefined {
  const context = useContext(TenantContext)
  return context?.filterEmpresaId
}
