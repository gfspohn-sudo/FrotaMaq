/** @vitest-environment jsdom */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const CLIENT_SCAN_ROOTS = ['src', 'index.html', 'vite.config.ts']
const BUNDLE_HINTS = ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'service_role', 'SUPABASE_SERVICE_ROLE_KEY']
const PASSWORD_LITERAL = 'SenhaSecreta#FrotaMaq-2026'

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walkFiles(full, acc)
      continue
    }
    if (/\.(ts|tsx|js|mjs|html)$/.test(name)) acc.push(full)
  }
  return acc
}

function collectClientFiles() {
  const files: string[] = []
  for (const entry of CLIENT_SCAN_ROOTS) {
    const full = resolve(ROOT, entry)
    if (!existsSync(full)) continue
    if (statSync(full).isDirectory()) walkFiles(full, files)
    else files.push(full)
  }
  return files
}

describe('Criptografia e exposição de segredos', () => {
  it('não expõe VITE_SUPABASE_SERVICE_ROLE_KEY no código client-side', () => {
    const viteConfig = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8')
    expect(viteConfig).toMatch(/envPrefix:\s*'VITE_'/)

    const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8')
    expect(envExample).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY/)
    expect(envExample).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(envExample).toMatch(/NÃO exponha no frontend|nunca no frontend/i)

    const hits: string[] = []
    for (const file of collectClientFiles()) {
      const contents = readFileSync(file, 'utf8')
      if (contents.includes('VITE_SUPABASE_SERVICE_ROLE_KEY')) {
        hits.push(relative(ROOT, file))
      }
    }
    expect(hits).toEqual([])
  })

  it('a service role permanece só no seed server-side, fora do bundle Vite', () => {
    const seed = readFileSync(resolve(ROOT, 'scripts/seed-test-users.mjs'), 'utf8')
    expect(seed).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
    expect(seed).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY/)
    expect(seed).toMatch(/createClient/)

    const distDir = resolve(ROOT, 'dist')
    if (!existsSync(distDir)) return

    const bundled = walkFiles(distDir)
      .filter(file => file.endsWith('.js'))
      .flatMap(file => {
        const contents = readFileSync(file, 'utf8')
        return BUNDLE_HINTS
          .filter(hint => contents.includes(hint) && hint !== 'service_role')
          .map(hint => `${relative(ROOT, file)}:${hint}`)
      })

    expect(bundled.filter(hit => hit.includes('VITE_SUPABASE_SERVICE_ROLE_KEY'))).toEqual([])
  })

  it('não persiste senhas em texto limpo no localStorage', () => {
    localStorage.clear()
    localStorage.setItem('frotamaq:last-profile', JSON.stringify({
      id: 'user-1',
      email: 'gestor@frotamaq.com',
      nome: 'Gestor',
      perfil: 'gestor',
      empresa_id: 'emp-1',
    }))
    localStorage.setItem('frotamaq_theme', 'dark')
    localStorage.setItem('frotamaq_locale', 'pt-BR')
    localStorage.setItem('sb-project-auth-token', JSON.stringify({
      access_token: 'jwt-access',
      refresh_token: 'jwt-refresh',
      token_type: 'bearer',
      user: { email: 'gestor@frotamaq.com' },
    }))

    const snapshot = JSON.stringify(Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index) ?? ''
        return [key, localStorage.getItem(key)]
      }),
    ))

    expect(snapshot).not.toContain(PASSWORD_LITERAL)
    expect(snapshot.toLowerCase()).not.toMatch(/"password"\s*:/)
    expect(snapshot).not.toMatch(/senha\s*[:=]/i)

    const authSource = readFileSync(resolve(ROOT, 'src/contexts/AuthContext.tsx'), 'utf8')
    expect(authSource).toMatch(/signInWithPassword\(\{\s*email,\s*password/)
    expect(authSource).not.toMatch(/localStorage\.setItem\([^)]*password/)
  })
})
