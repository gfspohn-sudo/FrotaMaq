import { useState } from 'react'
import { FileDown, FileSpreadsheet, Leaf, Truck, Wrench } from 'lucide-react'
import type { Usuario } from '@/types/database'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import type { ExecutiveReportKind } from '@/domain/services/ExecutiveReportService'
import { exportExecutiveReport, type ReportExportFormat } from '@/services/reportService'
import { formatErrorMessage } from '@/lib/formatError'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'

interface ExecutiveExportCardProps {
  profile: Usuario | null
  empresaId?: string
  tenantName: string
  period: PeriodoFinanceiro
  veiculoId?: string
  motoristaId?: string
  includeCosts: boolean
}

const REPORTS: Array<{
  kind: ExecutiveReportKind
  title: string
  description: string
  icon: typeof Truck
  accent: string
}> = [
  {
    kind: 'frota',
    title: 'Relatório Geral da Frota',
    description: 'Veículos, status atual, KM acumulado, combustível e resumo de saúde.',
    icon: Truck,
    accent: 'text-action bg-action/10',
  },
  {
    kind: 'esg',
    title: 'Relatório ESG e Emissões',
    description: 'KM por combustível, CO₂ emitido e árvores para compensação no período.',
    icon: Leaf,
    accent: 'text-success bg-success/10',
  },
  {
    kind: 'manutencoes',
    title: 'Histórico de Manutenções',
    description: 'Ordens de serviço, custos, peças trocadas e datas de preventiva.',
    icon: Wrench,
    accent: 'text-warning bg-warning/10',
  },
]

export function ExecutiveExportCard({
  profile,
  empresaId,
  tenantName,
  period,
  veiculoId,
  motoristaId,
  includeCosts,
}: ExecutiveExportCardProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'success' } | null>(null)

  async function handleExport(kind: ExecutiveReportKind, format: ReportExportFormat) {
    const key = `${kind}-${format}`
    setBusyKey(key)
    try {
      const result = await exportExecutiveReport({
        kind,
        format,
        profile,
        empresaId,
        tenantName,
        period,
        veiculoId: veiculoId || undefined,
        motoristaId: motoristaId || undefined,
        includeCosts,
      })
      const label = format === 'pdf' ? 'PDF' : 'CSV/Excel'
      setToast({ message: `${label} gerado: ${result.filename}`, variant: 'success' })
    } catch (error) {
      setToast({
        message: `Não foi possível exportar o relatório. ${formatErrorMessage(error)}`,
        variant: 'error',
      })
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-fg">Exportação executiva</h2>
        <p className="mt-1 text-xs text-fg-muted">
          O período e os filtros acima entram no ESG e no histórico de manutenções.
          O relatório geral usa o status atual da frota.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {REPORTS.map(item => {
          const Icon = item.icon
          return (
            <Card key={item.kind} className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 ${item.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">{item.title}</p>
                  <p className="mt-1 text-xs text-fg-muted">{item.description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExport(item.kind, 'pdf')}
                  loading={busyKey === `${item.kind}-pdf`}
                  disabled={busyKey != null}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleExport(item.kind, 'csv')}
                  loading={busyKey === `${item.kind}-csv`}
                  disabled={busyKey != null}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV / Excel
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  )
}
