import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { useAuth } from '@/contexts/AuthContext'
import { getVeiculoReport } from '@/services/vehicleReports'
import { formatCurrency } from '@/lib/maintenanceStatus'
import type { Manutencao } from '@/types/database'

export function VehicleReportPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [totalGeral, setTotalGeral] = useState(0)
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')

    const { data, error: reportError } = await getVeiculoReport(profile, id)
    setLoading(false)

    if (reportError) {
      setError(reportError.message)
      return
    }

    if (data) {
      setNomeExibicao(data.nomeExibicao)
      setTotalGeral(data.totalGeral)
      setManutencoes(data.manutencoes ?? [])
    }
  }, [id, profile])

  useEffect(() => { load() }, [load])

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
              <p className="mt-1 text-xs text-gray-400">Valor Total em manutenções</p>
            </Card>

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
                    <MaintenanceCard key={m.id} manutencao={m} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
