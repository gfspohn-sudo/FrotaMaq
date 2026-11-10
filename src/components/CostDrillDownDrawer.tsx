import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Drawer } from '@/components/ui/Drawer'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/maintenanceStatus'
import type { CostBreakdownItem } from '@/services/reports'

interface CostDrillDownDrawerProps {
  isOpen: boolean
  onClose: () => void
  periodLabel: string
  totalGeral: number
  totalMao: number
  totalPecas: number
  breakdown: CostBreakdownItem[]
}

const CHART_COLORS = ['#2563eb', '#059669']

export function CostDrillDownDrawer({
  isOpen,
  onClose,
  periodLabel,
  totalGeral,
  totalMao,
  totalPecas,
  breakdown,
}: CostDrillDownDrawerProps) {
  const chartData = [
    { name: 'Mão de obra', value: totalMao },
    { name: 'Peças', value: totalPecas },
  ].filter(d => d.value > 0)

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Discriminação do custo" subtitle={periodLabel}>
      <div className="space-y-4">
        <Card className="text-center">
          <p className="text-sm text-fg-muted">Total do período</p>
          <p className="mt-1 text-3xl font-semibold text-fg">{formatCurrency(totalGeral)}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-fg-muted">Mão de obra</p>
            <p className="mt-1 text-lg font-semibold text-action">{formatCurrency(totalMao)}</p>
          </Card>
          <Card>
            <p className="text-xs text-fg-muted">Peças</p>
            <p className="mt-1 text-lg font-semibold text-success">{formatCurrency(totalPecas)}</p>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card>
            <p className="mb-2 text-sm font-medium text-fg">Peças × Mão de obra</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <div className="space-y-2">
          {breakdown.length === 0 ? (
            <p className="py-4 text-center text-sm text-fg-muted">Sem itens no período.</p>
          ) : breakdown.map(item => (
            <Card key={item.manutencaoId}>
              <p className="text-sm font-medium text-fg">{item.descricao}</p>
              <p className="text-xs text-fg-muted">{item.placa} · {formatDate(item.dataHora)}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="text-action">Mão de obra {formatCurrency(item.valorMaoDeObra)}</span>
                <span className="text-success">Peças {formatCurrency(item.valorPecas)}</span>
              </div>
              <p className="mt-1 font-semibold text-fg">{formatCurrency(item.valorTotal)}</p>
            </Card>
          ))}
        </div>
      </div>
    </Drawer>
  )
}
