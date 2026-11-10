import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const projectRoot = import.meta.dirname
const NOMINATIM_USER_AGENT = 'FrotaMaq/1.0 (https://frotamaq.app; suporte@frotamaq.app)'

/** Pages: /FrotaMaq/ | Vercel e local: /  (defina VITE_BASE_PATH no job de deploy). */
function resolveViteBase(): string {
  const fromEnv = process.env.VITE_BASE_PATH?.trim()
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  }
  if (process.env.VITE_DEPLOY_TARGET === 'github-pages') {
    return '/FrotaMaq/'
  }
  return '/'
}

const geoProxy = {
  '/geo/nominatim': {
    target: 'https://nominatim.openstreetmap.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/geo\/nominatim/, ''),
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
      Accept: 'application/json',
    },
  },
  '/geo/osrm': {
    target: 'https://router.project-osrm.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/geo\/osrm/, ''),
  },
}

export default defineConfig({
  base: resolveViteBase(),
  plugins: [react(), tailwindcss()],
  envDir: '.',
  envPrefix: 'VITE_',
  server: {
    port: 5173,
    strictPort: true,
    proxy: geoProxy,
  },
  preview: {
    proxy: geoProxy,
  },
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, './src'),
    },
  },
})
