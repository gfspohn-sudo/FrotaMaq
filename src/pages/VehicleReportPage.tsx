import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getVeiculoReport } from '@/services/vehicleReports'
import { getVeiculoById } from '@/services/vehicles'
import { downloadVehicleReportCsv } from '@/services/vehicleReportExport'
import { formatCurrency } from '@/lib/maintenanceStatus'
import { getVeiculoKm } from '@/lib/dbCompat'
import type { Manutencao, Veiculo } from '@/types/database'

export function VehicleReportPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { canViewMaintenance } = usePermissions()
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [totalGeral, setTotalGeral] = useState(0)
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [selectedMaintenance, setSelectedMaintenance] = useState<Manutencao | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')

    const [reportRes, veiculoRes] = await Promise.all([
      getVeiculoReport(profile, id),
      getVeiculoById(id, profile),
    ])
    setLoading(false)

    if (reportRes.error) {
      setError(reportRes.error.message)
      return
    }

    if (veiculoRes.data) setVeiculo(veiculoRes.data)

    if (reportRes.data) {
      setNomeExibicao(reportRes.data.nomeExibicao)
      setTotalGeral(reportRes.data.totalGeral)
      setManutencoes(reportRes.data.manutencoes ?? [])
    }
  }, [id, profile])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  function handleDownload() {
    if (!veiculo) return
    downloadVehicleReportCsv(veiculo, manutencoes)
  }

  return (
    <div>
      <Header title="Relatório do Veículo" />

      <div className="space-y-4 px-4 py-4">
        <Link to={`/veiculos/${id}`} className="inline-flex items-center gap-1 text-sm text-action">
          <ArrowLeft className="h-4 w-4" /> Voltar ao veículo
        </Link>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : error ? (
          <Card>
            <p className="py-6 text-center text-sm text-danger">{error}</p>
          </Card>
        ) : (
          <>
            <Card className="text-center">
              <div className="mb-2 flex justify-center text-action">
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-500">{nomeExibicao}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
              <p className="mt-1 text-xs text-gray-400">Valor total em manutenções</p>
            </Card>

            {veiculo && (
              <Button className="w-full" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Relatório (Excel/CSV)
              </Button>
            )}

            {canViewMaintenance && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  Manutenções ({manutencoes.length})
                </h2>
                {manutencoes.length === 0 ? (
                  <Card>
                    <p className="py-4 text-center text-sm text-gray-500">Nenhuma manutenção registrada.</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {manutencoes.map(m => (
                      <MaintenanceCard
                        key={m.id}
                        manutencao={m}
                        onClick={() => setSelectedMaintenance(m)}
                        showFinancialDetails
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <MaintenanceDetailModal
        manutencao={selectedMaintenance}
        onClose={() => setSelectedMaintenance(null)}
        veiculoKm={veiculo ? getVeiculoKm(veiculo) : undefined}
      />
    </div>
  )
}
