export function getInitials(name?: string | null): string {
  if (!name?.trim()) return 'FM'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
