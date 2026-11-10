/** @vitest-environment jsdom */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { safeHttpsUrl } from '@/lib/safeMediaUrl'

const SQL_PAYLOAD = "'; DROP TABLE veiculos; --"
const XSS_PAYLOAD = '<script>window.__xss="pwned"</script><img src=x onerror="window.__xss=1">'

afterEach(() => {
  cleanup()
  delete (window as Window & { __xss?: string }).__xss
})

function walkSrc(dir = resolve(process.cwd(), 'src'), acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkSrc(full, acc)
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
  }
  return acc
}

describe('Injection — SQL (PostgREST) e XSS (React)', () => {
  it('SDK do Supabase envia filtros parametrizados, não SQL concatenado', async () => {
    const requests: Array<{ url: string; method: string; body: string }> = []

    const fetchStub: typeof fetch = async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      requests.push({
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        body: typeof init?.body === 'string' ? init.body : '',
      })
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': '0-0/0',
        },
      })
    }

    const client = createClient('https://security-tests.supabase.co', 'anon-test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchStub },
    })

    await client.from('veiculos').select('id, placa').eq('placa', SQL_PAYLOAD)
    await client.from('reservas').select('id, destino').eq('destino', SQL_PAYLOAD)

    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      const decoded = decodeURIComponent(request.url.replace(/\+/g, ' '))
      expect(request.url).toMatch(/\/rest\/v1\/(veiculos|reservas)/)
      expect(request.url).not.toMatch(/\/sql\b/)
      expect(request.url).toMatch(/=eq\./)
      expect(request.body.toLowerCase()).not.toContain('drop table')
      expect(decoded).toContain(SQL_PAYLOAD)
    }
  })

  it('React escapa payload XSS e não executa tags <script>', () => {
    render(createElement('p', { 'data-testid': 'user-content' }, XSS_PAYLOAD))

    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect((window as Window & { __xss?: string }).__xss).toBeUndefined()
    expect(screen.getByTestId('user-content').textContent).toBe(XSS_PAYLOAD)
    expect(screen.getByTestId('user-content').innerHTML).toContain('&lt;script&gt;')
  })

  it('código-fonte não usa sinks XSS perigosos e rejeita javascript: em mídia', () => {
    const sinks: string[] = []
    for (const file of walkSrc()) {
      const contents = readFileSync(file, 'utf8')
      if (contents.includes('dangerouslySetInnerHTML') || /\binnerHTML\s*=/.test(contents) || /\beval\s*\(/.test(contents)) {
        sinks.push(file.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, ''))
      }
    }
    expect(sinks).toEqual([])
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('https://cdn.frotamaq.app/foto.jpg')).toBe('https://cdn.frotamaq.app/foto.jpg')
  })
})
