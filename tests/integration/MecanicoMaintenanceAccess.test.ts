import { describe, it, expect } from 'vitest'
import { VehicleReportAuthorizationService } from '@/domain/services/VehicleReportAuthorizationService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'

describe('Mecânico — acesso a detalhes de manutenção (integração)', () => {
  const mecanico = UsuarioFactory.fromProps('3', 'Mec', 'm@test.com', 'emp-1', 'mecanico')
  const veiculoId = 'veiculo-42'

  it('bloqueia modal/detalhes quando solicitação não está APROVADA', () => {
    const ctx = { veiculoId, aprovados: [] as string[] }

    expect(VehicleReportAuthorizationService.podeAcessar(mecanico, {
      veiculoId,
      empresaId: 'emp-1',
      veiculosEscopoMotorista: [],
      veiculosRelatorioAprovadoMecanico: ctx.aprovados,
    })).toBe(false)

    expect(
      VehicleReportAuthorizationService.podeVerDetalhesManutencao(mecanico, veiculoId, ctx.aprovados),
    ).toBe(false)
  })

  it('libera detalhes e relatório quando gestor aprova (APROVADO)', () => {
    const aprovados = [veiculoId]

    expect(VehicleReportAuthorizationService.podeAcessar(mecanico, {
      veiculoId,
      empresaId: 'emp-1',
      veiculosEscopoMotorista: [],
      veiculosRelatorioAprovadoMecanico: aprovados,
    })).toBe(true)

    expect(
      VehicleReportAuthorizationService.podeVerDetalhesManutencao(mecanico, veiculoId, aprovados),
    ).toBe(true)
  })
})
