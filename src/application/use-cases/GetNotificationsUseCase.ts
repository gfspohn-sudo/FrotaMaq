import type { IAlertaRepository } from '@/domain/repositories/IAlertaRepository'
import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { PreventiveAlertService } from '@/domain/services/PreventiveAlertService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile } from '@/types/database'

export interface NotificationItem {
  id: string
  tipo: 'alerta' | 'reserva' | 'preventiva'
  titulo: string
  mensagem: string
  href: string
  data: string
}

export class GetNotificationsUseCase {
  private readonly alertaRepo: IAlertaRepository
  private readonly reservaRepo: IReservaRepository
  private readonly manutencaoRepo: IManutencaoRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(
    alertaRepo: IAlertaRepository,
    reservaRepo: IReservaRepository,
    manutencaoRepo: IManutencaoRepository,
    veiculoRepo: IVeiculoRepository,
  ) {
    this.alertaRepo = alertaRepo
    this.reservaRepo = reservaRepo
    this.manutencaoRepo = manutencaoRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(profile: UsuarioProfile | null, empresaId?: string) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const items: NotificationItem[] = []

    let veiculosEscopoMotorista: string[] | null = null
    if (usuario.perfil === 'motorista' && profile?.id) {
      const escopo = await this.reservaRepo.findVeiculosEscopoMotorista(profile.id)
      veiculosEscopoMotorista = escopo.data ?? []
    }

    const noEscopo = (veiculoId: string) => {
      if (veiculosEscopoMotorista === null) return true
      return veiculosEscopoMotorista.includes(veiculoId)
    }

    if (usuario.podeVisualizarAlertasGlobais()) {
      const { data: alertas } = await this.alertaRepo.findActive({ empresaId })
      for (const a of alertas ?? []) {
        if (!noEscopo(a.veiculo_id)) continue
        items.push({
          id: `alerta-${a.id}`,
          tipo: 'alerta',
          titulo: 'Alerta de manutenção',
          mensagem: a.mensagem,
          href: '/alertas',
          data: a.data_vencimento,
        })
      }
    }

    if (usuario.podeAprovarReserva()) {
      const { data: pendentes } = await this.reservaRepo.findAll({ empresaId, status: 'PENDENTE' })
      for (const r of pendentes ?? []) {
        items.push({
          id: `reserva-${r.id}`,
          tipo: 'reserva',
          titulo: 'Reserva pendente',
          mensagem: `${r.motoristaNome ?? 'Motorista'} solicitou ${r.veiculoPlaca ?? 'veículo'} — ${r.destino}`,
          href: '/reservas',
          data: r.dataViagem,
        })
      }
    }

    const { data: veiculos } = await this.veiculoRepo.findAll({ empresaId })
    const veiculosFiltrados = veiculosEscopoMotorista !== null
      ? (veiculos ?? []).filter(v => veiculosEscopoMotorista!.includes(v.id))
      : (veiculos ?? [])

    const { data: manutencoes } = await this.manutencaoRepo.findAll({ empresaId })

    const proximasPorVeiculo = new Map<string, { data: string | null; km: number | null }>()
    for (const m of manutencoes ?? []) {
      if (veiculosEscopoMotorista !== null && !veiculosEscopoMotorista.includes(m.veiculoId)) continue
      const current = proximasPorVeiculo.get(m.veiculoId) ?? { data: null, km: null }
      if (m.proximaManutencaoData) current.data = m.proximaManutencaoData
      if (m.proximaManutencaoKm != null) current.km = m.proximaManutencaoKm
      proximasPorVeiculo.set(m.veiculoId, current)
    }

    const preventiveInputs = veiculosFiltrados.map(v => ({
      veiculoId: v.id,
      placa: v.placa,
      proximaManutencaoData: proximasPorVeiculo.get(v.id)?.data ?? null,
      proximaManutencaoKm: proximasPorVeiculo.get(v.id)?.km ?? null,
      kmAtual: v.kmAtual.value,
    }))

    for (const alert of PreventiveAlertService.calcularAlertas(preventiveInputs)) {
      items.push({
        id: `preventiva-${alert.veiculoId}-${alert.tipo}`,
        tipo: 'preventiva',
        titulo: 'Manutenção preventiva',
        mensagem: alert.mensagem,
        href: `/veiculos/${alert.veiculoId}`,
        data: new Date().toISOString(),
      })
    }

    items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    return { data: items, count: items.length, error: null }
  }
}
