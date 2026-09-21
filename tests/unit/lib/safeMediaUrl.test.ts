import { describe, expect, it } from 'vitest'
import { safeHttpsUrl } from '@/lib/safeMediaUrl'

describe('safeHttpsUrl', () => {
  it('aceita apenas https absoluto', () => {
    expect(safeHttpsUrl('https://cdn.example.com/foto.jpg')).toBe('https://cdn.example.com/foto.jpg')
  })

  it('rejeita javascript, data e http', () => {
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('data:image/png;base64,aaaa')).toBeNull()
    expect(safeHttpsUrl('http://inseguro.example.com/x.png')).toBeNull()
  })

  it('rejeita vazio e relativo', () => {
    expect(safeHttpsUrl(null)).toBeNull()
    expect(safeHttpsUrl('')).toBeNull()
    expect(safeHttpsUrl('/uploads/foto.jpg')).toBeNull()
  })
})
