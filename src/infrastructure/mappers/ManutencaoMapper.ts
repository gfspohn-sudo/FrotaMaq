import type {
  Manutencao as ManutencaoDTO,
  MetodoPagamento,
  NovaManutencao,
  StatusManutencao,
  StatusManutencaoDb,
  TipoManutencao,
} from '@/types/database'
import { Manutencao } from '@/domain/entities/Manutencao'

type ManutencaoRow = ManutencaoDTO & {
  valor?: number
  data_hora?: string
  metodo_pagamento?: MetodoPagamento | null
  proxima_manutencao_data?: string | null
}

type VeiculoJoinRow = {
  placa?: string
  nome_exibicao?: string
  modelo?: string
  marca?: string
  quilometragem_atual?: number
  km_atual?: number
}

const VEICULO_SELECT = 'placa, nome_exibicao, quilometragem_atual, km_atual'

export const MANUTENCAO_VEICULO_SELECT = VEICULO_SELECT

export class ManutencaoMapper {
  static normalizeTipoFromDb(tipo: string): TipoManutencao {
    const t = tipo.trim().toLowerCase()
    if (t === 'preventiva' || t === 'corretiva' || t === 'preditiva') return t
    return 'preventiva'
  }

  static tipoToDb(tipo: TipoManutencao | string): string {
    return ManutencaoMapper.normalizeTipoFromDb(tipo).toUpperCase()
  }

  static normalizeStatusFromDb(status: string | undefined | null): StatusManutencao {
    const raw = (status ?? '').trim().toUpperCase()
    switch (raw) {
      case 'PENDENTE':
      case 'AGENDADA':
        return 'pendente'
      case 'EM_ANDAMENTO':
        return 'em_andamento'
      case 'CONCLUIDA':
      case 'CONCLUÍDA':
        return 'concluida'
      case 'CANCELADA':
        return 'cancelada'
      default: {
        const lower = raw.toLowerCase()
        if (lower === 'pendente' || lower === 'agendada') return 'pendente'
        if (lower === 'em_andamento') return 'em_andamento'
        if (lower === 'concluida') return 'concluida'
        if (lower === 'cancelada') return 'cancelada'
        return 'pendente'
      }
    }
  }

  static statusToDb(status: StatusManutencao): StatusManutencaoDb {
    switch (status) {
      case 'em_andamento':
        return 'EM_ANDAMENTO'
      case 'concluida':
        return 'CONCLUIDA'
      case 'cancelada':
        return 'CANCELADA'
      case 'pendente':
      default:
        return 'PENDENTE'
    }
  }

  static statusDbValuesForFilter(status: StatusManutencao): string[] {
    switch (status) {
      case 'em_andamento':
        return ['EM_ANDAMENTO', 'em_andamento']
      case 'concluida':
        return ['CONCLUIDA', 'concluida', 'CONCLUÍDA']
      case 'cancelada':
        return ['CANCELADA', 'cancelada']
      case 'pendente':
      default:
        return ['PENDENTE', 'pendente', 'AGENDADA', 'agendada']
    }
  }

  static normalizeFormaPagamento(value: string | null | undefined): MetodoPagamento | null {
    if (!value?.trim()) return null
    const v = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const map: Record<string, MetodoPagamento> = {
      pix: 'pix',
      cartao: 'cartao',
      boleto: 'boleto',
      faturado: 'faturado',
      dinheiro: 'dinheiro',
      transferencia: 'transferencia',
    }
    return map[v] ?? null
  }

  /** Fallback quando a coluna `status` ainda não foi preenchida. */
  static deriveStatus(dataManutencao: string): StatusManutencao {
    const date = new Date(dataManutencao)
    if (Number.isNaN(date.getTime())) return 'concluida'
    return date.getTime() > Date.now() ? 'pendente' : 'concluida'
  }

  static toDbPayload(input: NovaManutencao): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      empresa_id: input.empresa_id,
      veiculo_id: input.veiculo_id,
      descricao: input.descricao.trim(),
      valor_total: input.valor ?? 0,
      data_manutencao: input.data_hora,
      tipo: ManutencaoMapper.tipoToDb(input.tipo),
      status: ManutencaoMapper.statusToDb(input.status ?? 'pendente'),
    }

    if (input.local_manutencao != null) payload.local_manutencao = input.local_manutencao
    if (input.responsavel != null) payload.responsavel = input.responsavel
    if (input.forma_pagamento != null) payload.forma_pagamento = input.forma_pagamento
    if (input.data_proxima_manutencao != null) {
      payload.data_proxima_manutencao = input.data_proxima_manutencao
    }
    if (input.km_atual_veiculo != null) payload.km_atual_veiculo = input.km_atual_veiculo
    if (input.pecas_trocadas != null) payload.pecas_trocadas = input.pecas_trocadas
    if (input.valor_mao_de_obra != null) payload.valor_mao_de_obra = input.valor_mao_de_obra
    if (input.valor_pecas != null) payload.valor_pecas = input.valor_pecas
    if (input.observacao != null) payload.observacao = input.observacao
    if (input.proxima_manutencao_km != null) payload.proxima_manutencao_km = input.proxima_manutencao_km

    const mao = input.valor_mao_de_obra ?? 0
    const pecas = input.valor_pecas ?? 0
    if (mao > 0 || pecas > 0) {
      payload.valor_total = mao + pecas
    }

    return payload
  }

  static toDbUpdate(input: Partial<NovaManutencao>): Record<string, unknown> {
    const payload: Record<string, unknown> = {}
    if (input.descricao != null) payload.descricao = input.descricao
    if (input.valor != null) payload.valor_total = input.valor
    if (input.data_hora != null) payload.data_manutencao = input.data_hora
    if (input.tipo != null) payload.tipo = ManutencaoMapper.tipoToDb(input.tipo)
    if (input.status != null) payload.status = ManutencaoMapper.statusToDb(input.status)
    if (input.local_manutencao !== undefined) payload.local_manutencao = input.local_manutencao
    if (input.responsavel !== undefined) payload.responsavel = input.responsavel
    if (input.forma_pagamento !== undefined) payload.forma_pagamento = input.forma_pagamento
    if (input.data_proxima_manutencao !== undefined) {
      payload.data_proxima_manutencao = input.data_proxima_manutencao
    }
    if (input.km_atual_veiculo !== undefined) payload.km_atual_veiculo = input.km_atual_veiculo
    if (input.pecas_trocadas !== undefined) payload.pecas_trocadas = input.pecas_trocadas
    if (input.valor_mao_de_obra !== undefined) payload.valor_mao_de_obra = input.valor_mao_de_obra
    if (input.valor_pecas !== undefined) payload.valor_pecas = input.valor_pecas
    if (input.observacao !== undefined) payload.observacao = input.observacao
    if (input.proxima_manutencao_km !== undefined) payload.proxima_manutencao_km = input.proxima_manutencao_km
    if (input.valor_mao_de_obra != null || input.valor_pecas != null) {
      payload.valor_total = (input.valor_mao_de_obra ?? 0) + (input.valor_pecas ?? 0)
    }
    return payload
  }

  static parsePecasTrocadas(value: unknown): { descricao: string; quantidade: number; valor_unitario: number }[] {
    if (!value) return []
    const raw = typeof value === 'string' ? (() => {
      try { return JSON.parse(value) } catch { return [] }
    })() : value
    if (!Array.isArray(raw)) return []
    return raw
      .map((item: { descricao?: string; nome?: string; quantidade?: number; valor_unitario?: number; valor?: number }) => ({
        descricao: String(item?.descricao ?? item?.nome ?? ''),
        quantidade: Number(item?.quantidade ?? 1) || 1,
        valor_unitario: Number(item?.valor_unitario ?? item?.valor ?? 0) || 0,
      }))
      .filter(item => item.descricao.trim().length > 0)
  }

  private static parseVeiculoResumo(veiculo?: VeiculoJoinRow | null) {
    if (!veiculo?.placa) return null

    const nome = veiculo.nome_exibicao?.trim() ?? veiculo.modelo ?? ''
    const parts = nome.split(/\s+/)
    const marca = veiculo.marca ?? parts[0] ?? '—'
    const modelo = veiculo.modelo ?? (parts.length > 1 ? parts.slice(1).join(' ') : nome || '—')

    return {
      placa: veiculo.placa,
      modelo,
      marca,
      kmAtual: veiculo.quilometragem_atual ?? veiculo.km_atual ?? 0,
    }
  }

  static toDomain(row: ManutencaoRow): Manutencao {
    const dataManutencao = row.data_manutencao ?? row.data_hora ?? row.created_at
    const valor = row.valor_total ?? row.valor ?? 0
    const tipo = ManutencaoMapper.normalizeTipoFromDb(row.tipo)
    const dataProxima = row.data_proxima_manutencao ?? row.proxima_manutencao_data ?? null
    const formaPagamento = row.forma_pagamento ?? row.metodo_pagamento ?? null
    const local = row.local_manutencao ?? row.local ?? null
    const pecas = ManutencaoMapper.parsePecasTrocadas(row.pecas_trocadas)
    const valorPecas = row.valor_pecas ?? pecas.reduce((sum, p) => sum + p.quantidade * p.valor_unitario, 0)
    const valorMao = row.valor_mao_de_obra ?? 0

    return new Manutencao({
      id: row.id,
      empresaId: row.empresa_id,
      veiculoId: row.veiculo_id,
      tipo,
      descricao: row.descricao,
      dataHora: dataManutencao,
      local,
      responsavel: row.responsavel ?? null,
      valor,
      valorMaoDeObra: valorMao,
      valorPecas,
      pecasTrocadas: pecas,
      kmAtualVeiculo: row.km_atual_veiculo ?? null,
      observacao: row.observacao ?? null,
      proximaManutencaoKm: row.proxima_manutencao_km ?? null,
      metodoPagamento:
        ManutencaoMapper.normalizeFormaPagamento(formaPagamento) ?? formaPagamento,
      proximaManutencaoData: dataProxima,
      status: row.status
        ? ManutencaoMapper.normalizeStatusFromDb(row.status)
        : ManutencaoMapper.deriveStatus(dataManutencao),
      createdAt: row.created_at,
      veiculoResumo: ManutencaoMapper.parseVeiculoResumo(row.veiculos),
    })
  }

  static toDomainList(rows: ManutencaoRow[] | null): Manutencao[] | null {
    if (!rows) return null
    return rows.map(ManutencaoMapper.toDomain)
  }

  static toDTO(entity: Manutencao): ManutencaoDTO {
    return entity.toDTO()
  }

  static toDTOList(entities: Manutencao[] | null): ManutencaoDTO[] | null {
    if (!entities) return null
    return entities.map(e => e.toDTO())
  }
}
