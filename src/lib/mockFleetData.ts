import type {
  NovaManutencao,
  NovoVeiculo,
  PecaTrocada,
  StatusReserva,
  StatusVeiculo,
} from '@/types/database'

export const MOCK_PREFIX = '[MOCK]'

export const MOCK_VEICULOS: NovoVeiculo[] = [
  { placa: 'ABC-1D23', modelo: 'Hilux SRX', marca: 'Toyota', ano: 2023, km_atual: 45000, status: 'disponivel' },
  { placa: 'XYZ-9876', modelo: 'Ranger XLT', marca: 'Ford', ano: 2022, km_atual: 82000, status: 'em_viagem' },
  { placa: 'DEF-4A56', modelo: 'Sprinter 415', marca: 'Mercedes-Benz', ano: 2020, km_atual: 120000, status: 'em_manutencao' },
  { placa: 'GHI-3210', modelo: 'Fiorino Endurance', marca: 'Fiat', ano: 2019, km_atual: 89000, status: 'parado' },
  { placa: 'JKL-8C90', modelo: 'FH 540', marca: 'Volvo', ano: 2022, km_atual: 185000, status: 'disponivel' },
  { placa: 'MNO-2E45', modelo: 'R450', marca: 'Scania', ano: 2021, km_atual: 220000, status: 'em_viagem' },
  { placa: 'PQR-7F12', modelo: 'Constellation 24.280', marca: 'Volkswagen', ano: 2019, km_atual: 310000, status: 'em_manutencao' },
  { placa: 'STU-5G78', modelo: 'S10 LTZ', marca: 'Chevrolet', ano: 2024, km_atual: 18000, status: 'disponivel' },
]

export interface MockReservaPayload {
  empresa_id: string
  veiculo_id: string
  motorista_id: string
  data_viagem: string
  destino: string
  km_ida_volta: number
  km_inicial: number | null
  km_final: number | null
  status: StatusReserva
  observacao_gestor: string | null
  motivo_recusa: string | null
}

const OFICINAS = [
  'Oficina Central FrotaMaq',
  'Auto Center Sul',
  'Mecânica Pesada Norte',
  'Concessionária Premium',
]

const MECANICOS = [
  'João Mecânico',
  'Carlos Silva',
  'Ana Técnica',
  'Marcos Diesel',
]

const DESTINOS = [
  'Obra Norte — Canteiro 3',
  'Filial Campinas',
  'Porto de Santos',
  'Usina São José',
]

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]
}

function pecasPadrao(valorPecas: number): PecaTrocada[] {
  const filtro = Math.round(valorPecas * 0.43 * 100) / 100
  const pastilha = Math.round((valorPecas - filtro) * 100) / 100
  return [
    { descricao: 'Filtro de óleo', quantidade: 1, valor_unitario: filtro },
    { descricao: 'Pastilha de freio', quantidade: 1, valor_unitario: pastilha },
  ]
}

function statusOf(index: number): StatusVeiculo {
  return MOCK_VEICULOS[index]?.status ?? 'disponivel'
}

/** Manutenções para veículos em manutenção/parado e parte da frota disponível. */
export function vehicleGetsMaintenance(index: number, status?: StatusVeiculo): boolean {
  const s = status ?? statusOf(index)
  return s === 'em_manutencao' || s === 'parado' || index === 0 || index === 7
}

export function generateMockManutencoes(
  veiculoId: string,
  kmAtual: number,
  vehicleIndex: number,
  empresaId: string,
  status?: StatusVeiculo,
): NovaManutencao[] {
  if (!vehicleGetsMaintenance(vehicleIndex, status)) return []

  const valorPecas = 350
  const valorMaoDeObra = 200
  const km = kmAtual || MOCK_VEICULOS[vehicleIndex]?.km_atual || 45000

  return [
    {
      veiculo_id: veiculoId,
      empresa_id: empresaId,
      tipo: 'preventiva',
      descricao: `${MOCK_PREFIX} Troca de óleo e filtros`,
      data_hora: daysAgo(40),
      status: 'concluida',
      local_manutencao: pick(OFICINAS, vehicleIndex),
      responsavel: pick(MECANICOS, vehicleIndex),
      forma_pagamento: 'pix',
      valor_pecas: valorPecas,
      valor_mao_de_obra: valorMaoDeObra,
      observacao: 'Revisão preventiva realizada conforme plano da frota.',
      pecas_trocadas: pecasPadrao(valorPecas),
      km_atual_veiculo: Math.max(0, km - 8000),
      data_proxima_manutencao: daysFromNow(140),
      proxima_manutencao_km: km + 2000,
    },
    {
      veiculo_id: veiculoId,
      empresa_id: empresaId,
      tipo: 'corretiva',
      descricao: `${MOCK_PREFIX} Reparo de freios`,
      data_hora: daysAgo(12),
      status: status === 'em_manutencao' || statusOf(vehicleIndex) === 'em_manutencao'
        ? 'em_andamento'
        : 'concluida',
      local_manutencao: pick(OFICINAS, vehicleIndex + 1),
      responsavel: pick(MECANICOS, vehicleIndex + 1),
      forma_pagamento: 'faturado',
      valor_pecas: valorPecas,
      valor_mao_de_obra: valorMaoDeObra,
      observacao: 'Correção de desgaste irregular nas pastilhas dianteiras.',
      pecas_trocadas: pecasPadrao(valorPecas),
      km_atual_veiculo: km,
      data_proxima_manutencao: daysFromNow(90),
      proxima_manutencao_km: km + 10000,
    },
  ]
}

export function generateMockReservas(params: {
  veiculoId: string
  kmAtual: number
  vehicleIndex: number
  empresaId: string
  motoristaId: string
  status?: StatusVeiculo
}): MockReservaPayload[] {
  const { veiculoId, vehicleIndex, empresaId, motoristaId } = params
  const status = params.status ?? statusOf(vehicleIndex)
  const km = params.kmAtual || MOCK_VEICULOS[vehicleIndex]?.km_atual || 45000
  const destino = `${MOCK_PREFIX} ${pick(DESTINOS, vehicleIndex)}`
  const records: MockReservaPayload[] = []

  if (status === 'em_viagem') {
    records.push({
      empresa_id: empresaId,
      veiculo_id: veiculoId,
      motorista_id: motoristaId,
      data_viagem: daysAgo(1),
      destino,
      km_ida_volta: 180,
      km_inicial: km,
      km_final: null,
      status: 'APROVADO',
      observacao_gestor: null,
      motivo_recusa: null,
    })
  }

  if (status === 'disponivel' && (vehicleIndex === 0 || vehicleIndex === 7)) {
    const kmInicial = Math.max(0, km - 320)
    records.push({
      empresa_id: empresaId,
      veiculo_id: veiculoId,
      motorista_id: motoristaId,
      data_viagem: daysAgo(8),
      destino,
      km_ida_volta: 320,
      km_inicial: kmInicial,
      km_final: km,
      status: 'CONCLUIDA',
      observacao_gestor: null,
      motivo_recusa: null,
    })
  }

  if (status === 'parado' || vehicleIndex === 4) {
    records.push({
      empresa_id: empresaId,
      veiculo_id: veiculoId,
      motorista_id: motoristaId,
      data_viagem: daysAgo(3),
      destino,
      km_ida_volta: 90,
      km_inicial: km,
      km_final: null,
      status: 'REJEITADO',
      observacao_gestor: 'Veículo indisponível no período solicitado.',
      motivo_recusa: 'Veículo parado para inspeção de segurança; não autorizado para viagem.',
    })
  }

  return records
}

export function getMockPlacas(): string[] {
  return MOCK_VEICULOS.map(v => v.placa)
}

export function estimateMockCount(): number {
  return MOCK_VEICULOS.reduce(
    (total, veiculo, index) =>
      total + generateMockManutencoes('preview', veiculo.km_atual, index, 'preview', veiculo.status).length,
    0,
  )
}

export function estimateMockReservaCount(): number {
  return MOCK_VEICULOS.reduce(
    (total, veiculo, index) =>
      total + generateMockReservas({
        veiculoId: 'preview',
        kmAtual: veiculo.km_atual,
        vehicleIndex: index,
        empresaId: 'preview',
        motoristaId: 'preview',
        status: veiculo.status,
      }).length,
    0,
  )
}
