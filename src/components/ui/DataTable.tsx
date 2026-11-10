import type { ReactNode } from 'react'

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-surface ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </div>
  )
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
      {children}
    </thead>
  )
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function DataTh({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-3.5 py-3.5 font-medium ${className}`}>{children}</th>
}

export function DataTd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3.5 py-3.5 text-fg ${className}`}>{children}</td>
}

export function DataTr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr className={`odd:bg-surface even:bg-surface-muted/40 transition-colors duration-200 hover:bg-surface-muted/80 ${className}`}>
      {children}
    </tr>
  )
}
