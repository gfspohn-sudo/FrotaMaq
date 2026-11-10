import type { IAlertaRepository } from '@/domain/repositories/IAlertaRepository'
import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { PreventiveAlertService } from '@/domain/services/PreventiveAlertService'
import { TripDelayAlertService } from '@/domain/services/TripDelayAlertService'
import { EsgAlertService } from '@/domain/services/EsgAlertService'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile } from '@/types/database'
import { calculateFleetEmissions, resolveVehicleFuelType } from '@/utils/esgCalculator'

export type NotificationTipo = 'alerta' | 'reserva' | 'preventiva' | 'viagem_atraso' | 'esg'
export type NotificationSeveridade = 'critica' | 'alta' | 'media' | 'info'

export interface NotificationItem {
  id: string
  tipo: NotificationTipo
  severidade: NotificationSeveridade
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

  async execute(profile: UsuarioProfile | null, empresaId?: string, now = new Date()) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, { empresaId })
    if (scopeError) return { data: [], count: 0, error: scopeError }

    const tenantEmpresaId = scoped.empresaId
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

    const [{ data: veiculos }, { data: reservas }, { data: manutencoes }] = await Promise.all([
      this.veiculoRepo.findAll({ empresaId: tenantEmpresaId }),
      this.reservaRepo.findAll({
        empresaId: tenantEmpresaId,
        motoristaId: usuario.perfil === 'motorista' ? profile?.id : undefined,
      }),
      usuario.perfil === 'motorista'
        ? Promise.resolve({ data: [] })
        : this.manutencaoRepo.findAll({ empresaId: tenantEmpresaId }),
    ])

    if (usuario.podeVisualizarAlertasGlobais()) {
      const { data: alertas } = await this.alertaRepo.findActive({ empresaId: tenantEmpresaId })
      for (const a of alertas ?? []) {
        if (!noEscopo(a.veiculo_id)) continue
        items.push({
          id: `alerta-${a.id}`,
          tipo: 'alerta',
          severidade: a.tipo === 'vencida' ? 'critica' : 'alta',
          titulo: a.tipo === 'vencida' ? 'Manutenção vencida' : 'Manutenção próxima',
          mensagem: a.mensagem,
          href: '/alertas',
          data: a.data_vencimento,
        })
      }
    }

    if (usuario.podeAprovarReserva()) {
      for (const r of (reservas ?? []).filter(item => item.status === 'PENDENTE')) {
        items.push({
          id: `reserva-${r.id}`,
          tipo: 'reserva',
          severidade: 'alta',
          titulo: 'Reserva pendente',
          mensagem: `${r.motoristaNome ?? 'Motorista'} solicitou ${r.veiculoPlaca ?? 'veículo'} — ${r.destino}`,
          href: '/reservas',
          data: r.dataViagem,
        })
      }
    }

    if (usuario.perfil !== 'motorista') {
      const latestByVehicle = new Map<string, { data: string | null; km: number | null }>()
      for (const m of manutencoes ?? []) {
        const current = latestByVehicle.get(m.veiculoId)
        if (!current || new Date(m.dataHora).getTime() > new Date(current.data ?? 0).getTime()) {
          latestByVehicle.set(m.veiculoId, {
            data: m.proximaManutencaoData,
            km: m.proximaManutencaoKm,
          })
        }
      }

      const preventiveInputs = (veiculos ?? [])
        .filter(v => noEscopo(v.id))
        .map(v => {
          const latest = latestByVehicle.get(v.id)
          return {
            veiculoId: v.id,
            placa: v.placa,
            proximaManutencaoData: latest?.data ?? null,
            proximaManutencaoKm: latest?.km ?? null,
            kmAtual: v.kmAtual.value,
          }
        })

      for (const alert of PreventiveAlertService.calcularAlertas(preventiveInputs)) {
        items.push({
          id: `preventiva-${alert.veiculoId}-${alert.tipo}`,
          tipo: 'preventiva',
          severidade: alert.atrasada ? 'critica' : 'alta',
          titulo: alert.atrasada ? 'Manutenção vencida' : 'Manutenção próxima',
          mensagem: alert.mensagem,
          href: `/veiculos/${alert.veiculoId}`,
          data: now.toISOString(),
        })
      }
    }

    for (const alert of TripDelayAlertService.calcularAlertas(reservas ?? [], veiculos ?? [], now)) {
      if (!noEscopo(alert.veiculoId)) continue
      items.push({
        id: `viagem-${alert.reservaId}`,
        tipo: 'viagem_atraso',
        severidade: 'critica',
        titulo: 'Viagem em atraso',
        mensagem: alert.mensagem,
        href: '/reservas',
        data: alert.horarioRetorno,
      })
    }

    if (usuario.perfil !== 'motorista') {
      const trips = (reservas ?? [])
        .filter(reserva => reserva.status !== 'REJEITADO')
        .filter(reserva => {
          const data = new Date(reserva.dataViagem)
          return data.getFullYear() === now.getFullYear() && data.getMonth() === now.getMonth()
        })
        .map(reserva => {
          const veiculo = (veiculos ?? []).find(item => item.id === reserva.veiculoId)
          const km = reserva.kmPercorrido && reserva.kmPercorrido > 0
            ? reserva.kmPercorrido
            : reserva.kmIdaVolta
          return {
            km: km || 0,
            combustivel: resolveVehicleFuelType(veiculo
              ? { marca: veiculo.marca, modelo: veiculo.modelo }
              : { modelo: reserva.veiculoModelo }),
          }
        })

      const summary = calculateFleetEmissions(trips)
      const esg = EsgAlertService.calcularAlerta(summary.kgCo2, summary.arvores)
      if (esg) {
        items.push({
          id: `esg-marco-${esg.marcoKg}`,
          tipo: 'esg',
          severidade: esg.marcoKg >= 1000 ? 'alta' : 'media',
          titulo: 'Alerta ESG',
          mensagem: esg.mensagem,
          href: '/',
          data: now.toISOString(),
        })
      }
    }

    const order: Record<NotificationSeveridade, number> = { critica: 0, alta: 1, media: 2, info: 3 }
    items.sort((a, b) => {
      const bySeverity = order[a.severidade] - order[b.severidade]
      if (bySeverity !== 0) return bySeverity
      return new Date(b.data).getTime() - new Date(a.data).getTime()
    })

    return { data: items, count: items.length, error: null }
  }
}
