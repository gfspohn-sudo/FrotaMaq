/** Vite always exposes BASE_URL with a trailing slash. */
export function getRouterBasename(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base === '/' ? '/' : base.replace(/\/$/, '')
}
