import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  interactive?: boolean
}

export function Card({ children, className = '', onClick, interactive = false }: CardProps) {
  const isInteractive = Boolean(onClick) || interactive

  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${
        isInteractive
          ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-action/30 hover:shadow-md'
          : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
