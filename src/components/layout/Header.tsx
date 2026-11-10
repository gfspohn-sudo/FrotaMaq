interface HeaderProps {
  title?: string
  showGreeting?: boolean
}

export function Header({ title, showGreeting = false }: HeaderProps) {
  if (showGreeting || !title) return null

  return (
    <div className="px-4 pb-1 pt-6 lg:px-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
    </div>
  )
}
