import { Veiculo } from '@/domain/entities/Veiculo'
import { Manutencao } from '@/domain/entities/Manutencao'
import { Reserva } from '@/domain/entities/Reserva'
import type { ManutencaoProps } from '@/domain/entities/Manutencao'
import type { ReservaProps } from '@/domain/entities/Reserva'

export function createVeiculo(overrides: Partial<Parameters<typeof buildVeiculoProps>[0]> = {}) {
  return new Veiculo(buildVeiculoProps(overrides))
}

function buildVeiculoProps(overrides: Partial<{
  id: string
  empresaId: string | null
  placa: string
  modelo: string
  marca: string
  ano: number
  anoModelo: number
  anoCarroceria: number | null
  kmAtual: number
  status: 'disponivel' | 'em_viagem' | 'em_manutencao' | 'parado'
  fotoUrl: string | null
  createdAt: string
  empresaNome?: string | null
}>) {
  return {
    id: 'veh-1',
    empresaId: 'emp-1',
    placa: 'ABC-1D23',
    modelo: 'FH 540',
    marca: 'Volvo',
    ano: 2022,
    anoModelo: 2022,
    anoCarroceria: null,
    kmAtual: 50_000,
    status: 'disponivel' as const,
    fotoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    empresaNome: 'Empresa ABC',
    ...overrides,
  }
}

export function createManutencao(overrides: Partial<ManutencaoProps> = {}) {
  return new Manutencao({
    id: 'mnt-1',
    empresaId: 'emp-1',
    veiculoId: 'veh-1',
    tipo: 'preventiva',
    descricao: 'Troca de óleo',
    dataHora: '2026-09-05T10:00:00.000Z',
    local: 'Oficina',
    responsavel: 'João',
    valor: 1500,
    metodoPagamento: 'pix',
    proximaManutencaoData: null,
    proximaManutencaoKm: null,
    status: 'concluida',
    createdAt: '2026-09-05T10:00:00.000Z',
    veiculoResumo: { placa: 'ABC-1D23', modelo: 'FH 540' },
    ...overrides,
  })
}

export function createReserva(overrides: Partial<ReservaProps> = {}) {
  return new Reserva({
    id: 'res-1',
    empresaId: 'emp-1',
    veiculoId: 'veh-1',
    motoristaId: 'mot-1',
    dataViagem: '2026-11-09T08:00:00.000Z',
    destino: 'Campinas',
    kmIdaVolta: 120,
    kmInicial: 50_000,
    kmFinal: null,
    kmPercorrido: null,
    dataFim: null,
    status: 'APROVADO',
    observacaoGestor: null,
    motivoRecusa: null,
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    veiculoPlaca: 'ABC-1D23',
    veiculoModelo: 'FH 540',
    motoristaNome: 'Carlos',
    ...overrides,
  })
}
