import type {
  NovaManutencao,
  NovoVeiculo,
  StatusManutencao,
  TipoManutencao,
} from '@/types/database'

export const MOCK_PREFIX = '[MOCK]'

export const MOCK_VEICULOS: NovoVeiculo[] = [
  { placa: 'TST-C001', modelo: 'FH 540', marca: 'Volvo', ano: 2022, km_atual: 185000, status: 'em_operacao' },
  { placa: 'TST-C002', modelo: 'R450', marca: 'Scania', ano: 2021, km_atual: 220000, status: 'em_operacao' },
  { placa: 'TST-C003', modelo: 'Actros 2651', marca: 'Mercedes-Benz', ano: 2020, km_atual: 310000, status: 'em_manutencao' },
  { placa: 'TST-C004', modelo: 'Constellation 24.280', marca: 'Volkswagen', ano: 2019, km_atual: 420000, status: 'em_operacao' },
  { placa: 'TST-E001', modelo: '320 GC', marca: 'Caterpillar', ano: 2021, km_atual: 4200, status: 'em_manutencao' },
  { placa: 'TST-E002', modelo: 'PC200-8', marca: 'Komatsu', ano: 2020, km_atual: 6800, status: 'em_operacao' },
  { placa: 'TST-E003', modelo: 'EC220E', marca: 'Volvo CE', ano: 2022, km_atual: 3100, status: 'fora_de_operacao' },
  { placa: 'TST-T001', modelo: '6110J', marca: 'John Deere', ano: 2023, km_atual: 890, status: 'em_operacao' },
  { placa: 'TST-T002', modelo: 'T7.245', marca: 'New Holland', ano: 2022, km_atual: 1240, status: 'em_operacao' },
  { placa: 'TST-T003', modelo: 'MT 7160', marca: 'Massey Ferguson', ano: 2021, km_atual: 2100, status: 'em_operacao' },
  { placa: 'TST-U001', modelo: 'Hilux SRX', marca: 'Toyota', ano: 2023, km_atual: 45000, status: 'em_operacao' },
  { placa: 'TST-U002', modelo: 'Ranger XLT', marca: 'Ford', ano: 2022, km_atual: 62000, status: 'em_operacao' },
  { placa: 'TST-U003', modelo: 'Sprinter 415', marca: 'Mercedes-Benz', ano: 2020, km_atual: 120000, status: 'em_manutencao' },
  { placa: 'TST-U004', modelo: 'Fiorino', marca: 'Fiat', ano: 2019, km_atual: 89000, status: 'fora_de_operacao' },
  { placa: 'TST-U005', modelo: 'S10 LTZ', marca: 'Chevrolet', ano: 2024, km_atual: 18000, status: 'em_operacao' },
]

const OFICINAS = [
  'Oficina Central FrotaMaq',
  'Auto Center Sul',
  'Mecânica Pesada Norte',
  'Concessionária Premium',
  'Hidráulica Industrial Ltda',
]

const MECANICOS = [
  'João Mecânico',
  'Carlos Silva',
  'Pedro Hidráulica',
  'Ana Técnica',
  'Marcos Diesel',
]

const FORMAS_PAGAMENTO = ['PIX', 'Faturado', 'Cartão', 'Boleto', 'Dinheiro']

const DESCRICOES = [
  'Troca de óleo e filtros',
  'Revisão de freios e pastilhas',
  'Alinhamento e balanceamento',
  'Troca de correia dentada',
  'Diagnóstico eletrônico preditivo',
  'Reparo de suspensão',
  'Manutenção sistema hidráulico',
  'Revisão transmissão',
  'Troca de pneus',
  'Revisão ar condicionado',
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

function randomBetween(min: number, max: number, seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  const r = x - Math.floor(x)
  return Math.floor(r * (max - min + 1)) + min
}

interface MaintenanceTemplate {
  descricao: string
  tipo: TipoManutencao
  status: StatusManutencao
  dateOffset: number
  proximaDataOffset?: number
}

function getTemplatesForVehicle(vehicleIndex: number): MaintenanceTemplate[] {
  const base = pick(DESCRICOES, vehicleIndex)
  return [
    { descricao: `${base} - revisão 90d`, tipo: 'preventiva', status: 'concluida', dateOffset: -90, proximaDataOffset: 30 },
    { descricao: 'Troca de pastilhas de freio', tipo: 'corretiva', status: 'concluida', dateOffset: -60, proximaDataOffset: 60 },
    { descricao: 'Diagnóstico preditivo sensores', tipo: 'preditiva', status: 'concluida', dateOffset: -45 },
    { descricao: 'Troca de óleo e filtros', tipo: 'preventiva', status: 'concluida', dateOffset: -30, proximaDataOffset: -5 },
    { descricao: 'Alinhamento e balanceamento', tipo: 'preventiva', status: 'concluida', dateOffset: -3, proximaDataOffset: 12 },
    { descricao: 'Revisão programada', tipo: 'preventiva', status: 'pendente', dateOffset: 5, proximaDataOffset: 90 },
    { descricao: 'Inspeção preditiva', tipo: 'preditiva', status: 'pendente', dateOffset: 15, proximaDataOffset: 120 },
    { descricao: 'Revisão vencida pendente', tipo: 'preventiva', status: 'pendente', dateOffset: -12, proximaDataOffset: -3 },
    { descricao: 'Reparo hidráulico urgente', tipo: 'corretiva', status: 'pendente', dateOffset: -25, proximaDataOffset: -10 },
    { descricao: 'Manutenção em andamento', tipo: 'corretiva', status: 'em_andamento', dateOffset: -3, proximaDataOffset: 30 },
    { descricao: 'Calibração sensores IoT', tipo: 'preditiva', status: 'em_andamento', dateOffset: -7, proximaDataOffset: 45 },
  ]
}

export function generateMockManutencoes(
  veiculoId: string,
  _kmAtual: number,
  vehicleIndex: number,
  empresaId: string,
): NovaManutencao[] {
  const templates = getTemplatesForVehicle(vehicleIndex)

  return templates.map((tpl, i) => {
    const seed = vehicleIndex * 100 + i
    const data_hora = tpl.dateOffset < 0 ? daysAgo(-tpl.dateOffset) : daysFromNow(tpl.dateOffset)
    const data_proxima_manutencao = tpl.proximaDataOffset != null
      ? (tpl.proximaDataOffset < 0 ? daysAgo(-tpl.proximaDataOffset) : daysFromNow(tpl.proximaDataOffset))
      : undefined

    return {
      veiculo_id: veiculoId,
      empresa_id: empresaId,
      tipo: tpl.tipo,
      descricao: `${MOCK_PREFIX} ${tpl.descricao}`,
      data_hora,
      valor: randomBetween(500, 15000, seed),
      status: tpl.status,
      local_manutencao: pick(OFICINAS, seed),
      responsavel: pick(MECANICOS, seed + 1),
      forma_pagamento: pick(FORMAS_PAGAMENTO, seed + 2),
      data_proxima_manutencao,
    }
  })
}

export function getMockPlacas(): string[] {
  return MOCK_VEICULOS.map(v => v.placa)
}

export function estimateMockCount(): number {
  return MOCK_VEICULOS.length * getTemplatesForVehicle(0).length
}
