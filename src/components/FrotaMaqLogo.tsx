import { useId } from 'react'

interface FrotaMaqLogoProps {
  className?: string
  size?: number
  withWordmark?: boolean
  subtitle?: string
  compact?: boolean
}

export function FrotaMaqLogo({
  className = '',
  size = 36,
  withWordmark = false,
  subtitle,
  compact = false,
}: FrotaMaqLogoProps) {
  const uid = useId()
  const bg = `${uid}-bg`
  const machine = `${uid}-machine`
  const leaf = `${uid}-leaf`

  const mark = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className="shrink-0"
      role="img"
      aria-hidden={withWordmark}
      aria-label={withWordmark ? undefined : 'FrotaMaq'}
    >
      <defs>
        <linearGradient id={bg} x1="8" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={machine} x1="10" y1="16" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={leaf} x1="42" y1="10" x2="58" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect
        x="1.25"
        y="1.25"
        width="61.5"
        height="61.5"
        rx="14.75"
        stroke="#38bdf8"
        strokeOpacity=".22"
        strokeWidth="1.5"
      />
      <path fill="#0f172a" fillOpacity=".35" d="M8 50h48v4.5A16 16 0 0 1 48 56H16A16 16 0 0 1 8 50z" />
      <path
        fill={`url(#${machine})`}
        d="M11 39.2c0 1.2 1 2.2 2.2 2.2h31.1c1.4 0 2.6-1 2.9-2.4l1.1-5.2c.2-1.1-.4-2.2-1.5-2.6l-8.3-3.1-3.4-6.3A3.4 3.4 0 0 0 32.1 20H21.6c-.9 0-1.8.5-2.3 1.3L16.4 27H13.2A2.2 2.2 0 0 0 11 29.2v10z"
      />
      <path
        fill="#e0f2fe"
        d="M21.4 22.4h9.6c.7 0 1.2.6 1.1 1.3l-.6 4.2c-.1.7-.7 1.2-1.4 1.2H20.8c-.8 0-1.4-.7-1.2-1.5l1-4.2c.1-.6.7-1 1.3-1z"
      />
      <path fill="#1d4ed8" d="M11 32.6h9.2l1.3-4.6H16.6L13.8 32c-.3.4-.2.6.2.6z" />
      <circle cx="20.4" cy="44.6" r="4.6" fill="#cbd5e1" />
      <circle cx="20.4" cy="44.6" r="2" fill="#0f172a" />
      <circle cx="40.2" cy="44.6" r="4.6" fill="#cbd5e1" />
      <circle cx="40.2" cy="44.6" r="2" fill="#0f172a" />
      <path fill={`url(#${leaf})`} d="M46.2 13.5c7.4 2.4 11.6 8.8 10.2 15.4-6.8-1.2-12.4-6.8-10.2-15.4z" />
      <path stroke="#a7f3d0" strokeLinecap="round" strokeWidth="1.4" d="M47.2 16.2c1.8 4.6 5.6 8 9.8 9.6" />
      <circle cx="50.8" cy="37.2" r="2.15" fill="#34d399" />
      <circle cx="57.1" cy="32.4" r="1.45" fill="#38bdf8" />
      <circle cx="56.6" cy="42.4" r="1.45" fill="#60a5fa" />
      <path stroke="#67e8f9" strokeLinecap="round" strokeWidth="1.15" d="M52.6 36.2 55.9 33.4M52.5 38.6l2.9 2.7" />
    </svg>
  )

  if (!withWordmark) {
    return <span className={className}>{mark}</span>
  }

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      {mark}
      <div className="min-w-0 leading-tight">
        <p className={`truncate font-semibold tracking-tight text-fg ${compact ? 'text-sm' : 'text-[15px]'}`}>
          FrotaMaq
        </p>
        {subtitle ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-action">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
