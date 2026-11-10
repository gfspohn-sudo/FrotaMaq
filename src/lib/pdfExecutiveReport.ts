import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellHookData, RowInput, UserOptions } from 'jspdf-autotable'
import {
  formatEmittedAt,
  type ExecutiveReportMeta,
  type ReportKpi,
} from '@/domain/services/ExecutiveReportService'

type Rgb = [number, number, number]

const COLORS = {
  navy: [15, 23, 42] as Rgb,
  navySoft: [30, 41, 59] as Rgb,
  action: [37, 99, 235] as Rgb,
  success: [5, 150, 105] as Rgb,
  warning: [217, 119, 6] as Rgb,
  danger: [225, 29, 72] as Rgb,
  slate: [100, 116, 139] as Rgb,
  muted: [71, 85, 105] as Rgb,
  line: [226, 232, 240] as Rgb,
  canvas: [248, 250, 252] as Rgb,
  white: [255, 255, 255] as Rgb,
}

const TONE_COLORS: Record<ReportKpi['tone'], Rgb> = {
  navy: COLORS.navy,
  success: COLORS.success,
  action: COLORS.action,
  warning: COLORS.warning,
  danger: COLORS.danger,
  slate: COLORS.slate,
}

const STATUS_TEXT_COLORS: Record<string, Rgb> = {
  Disponível: COLORS.success,
  'Em viagem': COLORS.action,
  'Em manutenção': COLORS.warning,
  Parado: COLORS.slate,
  'Em dia': COLORS.success,
  'Atenção': COLORS.warning,
  'Crítico': COLORS.danger,
  Concluída: COLORS.success,
  Pendente: COLORS.warning,
  'Em andamento': COLORS.action,
  Cancelada: COLORS.slate,
  Preventiva: COLORS.success,
  Corretiva: COLORS.danger,
  Preditiva: COLORS.action,
  Diesel: COLORS.navy,
  Gasolina: COLORS.warning,
  Etanol: COLORS.success,
  Elétrico: COLORS.action,
}

const HEADER_HEIGHT = 36
const FOOTER_HEIGHT = 14
const MARGIN_X = 14

export interface ExecutivePdfTable {
  orientation?: 'portrait' | 'landscape'
  headers: string[]
  rows: Array<Array<string | number>>
  kpis?: ReportKpi[]
  emptyMessage?: string
  columnStyles?: UserOptions['columnStyles']
  foot?: RowInput[]
}

function pageSize(doc: jsPDF) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  }
}

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...COLORS.navy)
  doc.roundedRect(x, y, 12, 12, 2.2, 2.2, 'F')
  doc.setFillColor(...COLORS.action)
  doc.rect(x, y + 9, 12, 3, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('FM', x + 6, y + 6.6, { align: 'center' })
}

function drawHeader(doc: jsPDF, meta: ExecutiveReportMeta) {
  const { width } = pageSize(doc)

  doc.setFillColor(...COLORS.white)
  doc.rect(0, 0, width, HEADER_HEIGHT, 'F')

  drawLogo(doc, MARGIN_X, 8)

  doc.setTextColor(...COLORS.navy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('FrotaMaq', MARGIN_X + 15, 13.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.slate)
  doc.text('Gestão de Frotas e Máquinas', MARGIN_X + 15, 18.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.navy)
  doc.text(meta.title, MARGIN_X + 15, 25.5)

  if (meta.periodLabel) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(meta.periodLabel, MARGIN_X + 15, 30.5)
  }

  const rightX = width - MARGIN_X
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(`Emitido em ${formatEmittedAt(meta.emittedAt)}`, rightX, 13.5, { align: 'right' })
  doc.setTextColor(...COLORS.navy)
  doc.setFont('helvetica', 'bold')
  doc.text(meta.userName, rightX, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.muted)
  doc.text(meta.userRole, rightX, 24, { align: 'right' })
  doc.setTextColor(...COLORS.action)
  doc.text(meta.tenantName, rightX, 29.5, { align: 'right' })

  doc.setDrawColor(...COLORS.action)
  doc.setLineWidth(0.7)
  doc.line(MARGIN_X, HEADER_HEIGHT - 1.2, width - MARGIN_X, HEADER_HEIGHT - 1.2)
}

function drawFooter(doc: jsPDF, page: number, pageCount: number) {
  const { width, height } = pageSize(doc)
  const y = height - 8

  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y - 4, width - MARGIN_X, y - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.slate)
  doc.text('FrotaMaq  ·  Relatório confidencial', MARGIN_X, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.navy)
  doc.text(`Página ${page} de ${pageCount}`, width - MARGIN_X, y, { align: 'right' })
}

function drawKpis(doc: jsPDF, kpis: ReportKpi[], startY: number): number {
  if (kpis.length === 0) return startY

  const { width } = pageSize(doc)
  const gap = 3
  const boxH = 16
  const boxW = (width - MARGIN_X * 2 - gap * (kpis.length - 1)) / kpis.length

  kpis.forEach((kpi, index) => {
    const x = MARGIN_X + index * (boxW + gap)
    const tone = TONE_COLORS[kpi.tone]

    doc.setFillColor(...COLORS.canvas)
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, startY, boxW, boxH, 1.6, 1.6, 'FD')

    doc.setFillColor(...tone)
    doc.roundedRect(x, startY, 1.4, boxH, 0.4, 0.4, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.slate)
    doc.text(kpi.label.toUpperCase(), x + 4.2, startY + 5.4)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COLORS.navy)
    const valueLines = doc.splitTextToSize(kpi.value, boxW - 7)
    doc.text(valueLines, x + 4.2, startY + 11.2)
  })

  return startY + boxH + 6
}

function applyStatusColors(data: CellHookData) {
  if (data.section !== 'body') return
  const raw = String(data.cell.raw ?? '')
  const color = STATUS_TEXT_COLORS[raw]
  if (!color) return
  data.cell.styles.textColor = color
  data.cell.styles.fontStyle = 'bold'
}

export function createExecutivePdf(meta: ExecutiveReportMeta, table: ExecutivePdfTable): jsPDF {
  const doc = new jsPDF({
    orientation: table.orientation ?? 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  drawHeader(doc, meta)
  const tableStart = drawKpis(doc, table.kpis ?? [], HEADER_HEIGHT + 4)

  if (table.rows.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.muted)
    doc.text(table.emptyMessage ?? 'Nenhum registro encontrado para os filtros selecionados.', MARGIN_X, tableStart + 8)
  } else {
    autoTable(doc, {
      startY: tableStart,
      head: [table.headers],
      body: table.rows,
      foot: table.foot,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.2,
        textColor: COLORS.navy,
        lineColor: COLORS.line,
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLORS.navy,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      footStyles: {
        fillColor: COLORS.navySoft,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: COLORS.canvas,
      },
      columnStyles: table.columnStyles,
      margin: { top: HEADER_HEIGHT + 4, left: MARGIN_X, right: MARGIN_X, bottom: FOOTER_HEIGHT + 4 },
      didParseCell: applyStatusColors,
      didDrawPage: data => {
        if (data.pageNumber > 1) drawHeader(doc, meta)
      },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    drawFooter(doc, page, pageCount)
  }

  return doc
}

export function pdfToBlob(doc: jsPDF): Blob {
  return doc.output('blob')
}
