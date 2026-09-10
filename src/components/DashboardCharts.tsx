import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/maintenanceStatus'
import type { MaintenanceDashboard } from '@/services/reports'

const STATUS_COLORS = { concluidas: '#22c55e', proximas: '#f97316', vencidas: '#ef4444' }
const TYPE_COLORS = ['#2563eb', '#22c55e', '#f97316']

interface DashboardChartsProps {
  dashboard: MaintenanceDashboard
  totalGeral?: number
  periodLabel?: string
  showCostCard?: boolean
}

export function DashboardCharts({
  dashboard,
  totalGeral,
  periodLabel = 'Custo total do mês',
  showCostCard = false,
}: DashboardChartsProps) {
  const statusChartData = [
    { name: 'Concluídas', value: dashboard.statusCounts.concluidas, color: STATUS_COLORS.concluidas },
    { name: 'Próximas', value: dashboard.statusCounts.proximas, color: STATUS_COLORS.proximas },
    { name: 'Vencidas', value: dashboard.statusCounts.vencidas, color: STATUS_COLORS.vencidas },
  ].filter(d => d.value > 0)

  const typeChartData = [
    { name: 'Preventiva', value: dashboard.typeCounts.preventiva, color: TYPE_COLORS[0] },
    { name: 'Corretiva', value: dashboard.typeCounts.corretiva, color: TYPE_COLORS[1] },
    { name: 'Preditiva', value: dashboard.typeCounts.preditiva, color: TYPE_COLORS[2] },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-4">
      {showCostCard && totalGeral != null && (
        <Card className="text-center">
          <p className="text-sm text-gray-500">{periodLabel}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
        </Card>
      )}

      {(statusChartData.length > 0 || typeChartData.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {statusChartData.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-medium text-gray-700">Status das manutenções</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          {typeChartData.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-medium text-gray-700">Distribuição por tipo de manutenção</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {typeChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
