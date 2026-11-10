import type { Manutencao, Reserva, Veiculo } from '@/types/database'
import { getManutencaoData, getManutencaoStatus, getManutencaoValor, getVeiculoKm, getVeiculoMarca, getVeiculoModelo } from '@/lib/dbCompat'
import {
  calculateFleetEmissions,
  calculateTripEmissions,
  COMBUSTIVEL_LABELS,
  formatArvores,
  formatCo2Mass,
  resolveVehicleFuelType,
  type TipoCombustivel,
} from '@/utils/esgCalculator'

export type NivelRiscoIa = 'baixo' | 'medio' | 'alto'
export type FonteAnaliseIa = 'gemini' | 'heuristica'

export interface ViagemTelemetria {
  destino: string
  data: string
  kmIdaVolta: number
  status: string
}

export interface ManutencaoTelemetria {
  descricao: string
  tipo: string
  data: string
  status: string
  km: number | null
  valor: number
  pecas: string[]
}

export interface VehicleTelemetryInput {
  id: string
  placa: string
  modelo: string
  marca: string
  ano: number
  kmAtual: number
  status: string
  combustivel: TipoCombustivel
  intervaloManutencaoKm: number
  intervaloManutencaoDias: number
  manutencoes: ManutencaoTelemetria[]
  viagens: ViagemTelemetria[]
}

export interface AcaoSugeridaIa {
  tipo: 'agendar_manutencao'
  label: string
  veiculoId: string
}

export interface IaInsight {
  veiculoId: string
  placa: string
  modelo: string
  nivelRisco: NivelRiscoIa
  resumo: string
  recomendacoes: string[]
  acoes: AcaoSugeridaIa[]
  fonte: FonteAnaliseIa
  aviso?: string
}

export interface FleetIaInsight {
  destaque: IaInsight | null
  outros: IaInsight[]
  fonte: FonteAnaliseIa
  aviso?: string
}

export interface AnalyzeOptions {
  apiKey?: string | null
  fetchImpl?: typeof fetch
  now?: Date
  timeoutMs?: number
}

export type IaChatRole = 'user' | 'assistant'

export interface IaChatMessage {
  id: string
  role: IaChatRole
  content: string
  fonte?: FonteAnaliseIa
}

export interface IaChatReply {
  content: string
  fonte: FonteAnaliseIa
  aviso?: string
}

export interface FleetOsSnapshot {
  descricao: string
  tipo: string
  data: string
  status: string
  pecas: string[]
  valor: number
}

export interface FleetTripSnapshot {
  destino: string
  data: string
  km: number
  status: string
}

export interface FleetVehicleSnapshot {
  placa: string
  marca: string
  modelo: string
  ano: number
  idadeAnos: number
  combustivel: TipoCombustivel
  combustivelLabel: string
  status: string
  kmAcumulado: number
  kmRodadosMes: number
  intervaloPreventivaKm: number
  intervaloPreventivaDias: number
  preventivaEsteMes: boolean
  nivelRisco: NivelRiscoIa
  ultimaManutencao: {
    data: string
    descricao: string
    km: number | null
    valor: number
  } | null
  manutencoesPendentes: number
  manutencoesRecentes: FleetOsSnapshot[]
  custoManutencoesConcluidas: number
  viagensAtivas: FleetTripSnapshot[]
  viagensMes: FleetTripSnapshot[]
  historicoViagens: FleetTripSnapshot[]
  esgMes: { kgCo2: number; arvores: number; km: number }
}

export const IA_QUICK_SUGGESTIONS = [
  'Quais veículos estão disponíveis para viagem agora?',
  'Quais veículos precisam de revisão preventiva este mês?',
  'Qual o resumo geral de saúde da frota?',
  'Qual o veículo mais rodado do mês e suas viagens?',
] as const

export const IA_READ_ONLY_REFUSAL = [
  'Sou um assistente exclusivo para **análise e consulta** dos dados da frota (somente leitura).',
  'Não executo alterações, cadastros nem exclusões no banco de dados.',
  'Para agendar manutenção, criar reserva ou atualizar um veículo, use as telas do FrotaMaq. Posso consultar status, preventiva, viagens e ESG.',
].join('\n')

const AVISO_CHAT_FALLBACK =
  'A IA online está indisponível. Segue uma resposta local com base nos dados da frota.'

export const NIVEL_RISCO_ORDEM: Record<NivelRiscoIa, number> = {
  baixo: 0,
  medio: 1,
  alto: 2,
}

export const KM_FAIXA_MEDIO = 80_000
export const KM_FAIXA_ALTO = 150_000
export const INTERVALO_KM_PADRAO = 10_000
export const INTERVALO_DIAS_PADRAO = 180
export const JANELA_VIAGENS_DIAS = 60

const ESTRADA_NAO_PAVIMENTADA = /terra|chão|chao|cascalho|rural|fazenda|sítio|sitio|interior|ramal|não paviment|nao paviment|off[- ]?road/i
/** 1.5/2.0 Flash saíram de linha; a chave atual responde em 3.1 Flash Lite. */
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-1.5-flash'] as const
const AVISO_FALLBACK =
  'A IA online está indisponível. Exibindo análise local com base na quilometragem e no histórico do veículo.'

const NIVEIS_VALIDOS: NivelRiscoIa[] = ['baixo', 'medio', 'alto']

export function getGeminiApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim()
  if (!key || /sua-|your-|placeholder|gemini-key-aqui|undefined|null/i.test(key)) {
    return ''
  }
  return key
}

export function isGeminiConfigured(apiKey = getGeminiApiKey()): boolean {
  if (!apiKey || apiKey.length < 10) return false
  const lower = apiKey.toLowerCase()
  return !lower.includes('sua-chave') && !lower.includes('your-api') && !lower.includes('gemini-key-aqui')
}

export function vehicleAgeYears(ano: number, now: Date): number {
  if (!Number.isFinite(ano) || ano < 1970) return 0
  return Math.max(0, now.getFullYear() - ano)
}

export function buildVehicleTelemetry(
  veiculo: Veiculo,
  manutencoes: Manutencao[],
  viagens: Reserva[],
): VehicleTelemetryInput {
  return {
    id: veiculo.id,
    placa: veiculo.placa,
    modelo: getVeiculoModelo(veiculo),
    marca: getVeiculoMarca(veiculo),
    ano: veiculo.ano_modelo ?? veiculo.ano ?? 0,
    kmAtual: getVeiculoKm(veiculo),
    status: veiculo.status,
    combustivel: resolveVehicleFuelType(veiculo),
    intervaloManutencaoKm: veiculo.intervalo_manutencao_km ?? INTERVALO_KM_PADRAO,
    intervaloManutencaoDias: veiculo.intervalo_manutencao_dias ?? INTERVALO_DIAS_PADRAO,
    manutencoes: manutencoes
      .filter(m => m.veiculo_id === veiculo.id)
      .map(m => ({
        descricao: m.descricao,
        tipo: m.tipo,
        data: getManutencaoData(m),
        status: getManutencaoStatus(m),
        km: m.km_atual_veiculo ?? null,
        valor: getManutencaoValor(m),
        pecas: (m.pecas_trocadas ?? []).map(p => p.descricao),
      })),
    viagens: viagens
      .filter(v => v.veiculo_id === veiculo.id)
      .map(v => ({
        destino: v.destino,
        data: v.data_viagem,
        kmIdaVolta: v.km_percorrido && v.km_percorrido > 0 ? v.km_percorrido : (v.km_ida_volta ?? 0),
        status: v.status,
      })),
  }
}

export function parseGeminiInsightJson(raw: string): Partial<IaInsight> | null {
  const jsonText = extractJsonBlock(raw)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const nivel = normalizeNivel(parsed.nivelRisco ?? parsed.nivel_risco ?? parsed.risco)
    const recomendacoes = normalizeStringList(parsed.recomendacoes ?? parsed.recommendations)
    const resumo = typeof parsed.resumo === 'string' ? parsed.resumo.trim() : ''

    if (!nivel && recomendacoes.length === 0 && !resumo) return null

    return {
      nivelRisco: nivel ?? undefined,
      resumo,
      recomendacoes,
    }
  } catch {
    return null
  }
}

export function analyzeVehicleHeuristic(input: VehicleTelemetryInput, now = new Date()): IaInsight {
  const age = vehicleAgeYears(input.ano, now)
  const intervaloKm = input.intervaloManutencaoKm || INTERVALO_KM_PADRAO
  const ultimaConcluida = latestCompletedMaintenance(input)
  const kmDesdeUltima = ultimaConcluida?.km != null
    ? Math.max(0, input.kmAtual - ultimaConcluida.km)
    : input.kmAtual
  const diasDesdeUltima = daysSince(ultimaConcluida?.data, now)
  const viagensRecentes = recentTrips(input.viagens, now)
  const kmViagensRecentes = viagensRecentes.reduce((sum, v) => sum + (v.kmIdaVolta || 0), 0)
  const destinosNaoPavimentados = viagensRecentes.filter(v => ESTRADA_NAO_PAVIMENTADA.test(v.destino))
  const pendentes = input.manutencoes.filter(m => m.status === 'pendente' || m.status === 'em_andamento')
  const kmRestantesIntervalo = intervaloKm - kmDesdeUltima

  let score = 0
  if (input.kmAtual >= KM_FAIXA_ALTO) score += 5
  else if (input.kmAtual >= KM_FAIXA_MEDIO) score += 2
  else if (input.kmAtual >= 40_000) score += 1

  if (age >= 12) score += 3
  else if (age >= 8) score += 2
  else if (age >= 5) score += 1

  if (kmRestantesIntervalo <= 0 && input.kmAtual > 0) score += 4
  else if (kmRestantesIntervalo <= intervaloKm * 0.2) score += 2

  if (diasDesdeUltima != null && diasDesdeUltima > input.intervaloManutencaoDias) score += 2
  if (pendentes.length > 0) score += 3
  if (input.status === 'em_manutencao') score += 1
  if (destinosNaoPavimentados.length > 0) score += 2
  if (kmViagensRecentes >= 1_500) score += 1
  if (!ultimaConcluida && input.kmAtual >= intervaloKm) score += 2

  const nivelRisco: NivelRiscoIa = score >= 5 ? 'alto' : score >= 2 ? 'medio' : 'baixo'
  const recomendacoes = buildHeuristicRecommendations({
    input,
    age,
    kmDesdeUltima,
    kmRestantesIntervalo,
    destinosNaoPavimentados,
    kmViagensRecentes,
    pendentes,
    ultimaConcluida,
  })

  return {
    veiculoId: input.id,
    placa: input.placa,
    modelo: input.modelo,
    nivelRisco,
    resumo: buildHeuristicSummary(input, nivelRisco, age),
    recomendacoes,
    acoes: [acaoAgendar(input.id)],
    fonte: 'heuristica',
  }
}

export async function analyzeVehicleTelemetry(
  input: VehicleTelemetryInput,
  options: AnalyzeOptions = {},
): Promise<IaInsight> {
  const now = options.now ?? new Date()
  const fallback = analyzeVehicleHeuristic(input, now)
  const apiKey = options.apiKey === undefined ? getGeminiApiKey() : options.apiKey

  if (!isGeminiConfigured(apiKey ?? '')) {
    return fallback
  }

  try {
    const generated = await requestGeminiInsightJson(buildVehiclePrompt(input, now), apiKey!, options)
    if (!generated) {
      return { ...fallback, aviso: AVISO_FALLBACK }
    }
    return mergeGeminiInsight(fallback, generated, 'gemini')
  } catch {
    return { ...fallback, aviso: AVISO_FALLBACK }
  }
}

export async function analyzeFleetTelemetry(
  inputs: VehicleTelemetryInput[],
  options: AnalyzeOptions = {},
): Promise<FleetIaInsight> {
  const now = options.now ?? new Date()
  const locais = [...inputs]
    .map(item => analyzeVehicleHeuristic(item, now))
    .sort(compareInsightRisk)

  const destaqueLocal = locais[0] ?? null
  const outrosLocal = locais.slice(1, 4)
  const apiKey = options.apiKey === undefined ? getGeminiApiKey() : options.apiKey

  if (!destaqueLocal) {
    return { destaque: null, outros: [], fonte: 'heuristica' }
  }

  if (!isGeminiConfigured(apiKey ?? '')) {
    return { destaque: destaqueLocal, outros: outrosLocal, fonte: 'heuristica' }
  }

  try {
    const generated = await requestGeminiInsightJson(buildFleetPrompt(inputs, now), apiKey!, options)
    if (!generated) {
      return {
        destaque: { ...destaqueLocal, aviso: AVISO_FALLBACK },
        outros: outrosLocal,
        fonte: 'heuristica',
        aviso: AVISO_FALLBACK,
      }
    }

    const destaque = mergeGeminiInsight(destaqueLocal, generated, 'gemini')
    return { destaque, outros: outrosLocal, fonte: 'gemini' }
  } catch {
    return {
      destaque: { ...destaqueLocal, aviso: AVISO_FALLBACK },
      outros: outrosLocal,
      fonte: 'heuristica',
      aviso: AVISO_FALLBACK,
    }
  }
}

export function buildFleetSnapshot(inputs: VehicleTelemetryInput[], now = new Date()): FleetVehicleSnapshot[] {
  return inputs.map(input => {
    const insight = analyzeVehicleHeuristic(input, now)
    const ultima = latestCompletedMaintenance(input)
    const ativas = input.viagens.filter(v => v.status === 'PENDENTE' || v.status === 'APROVADO')
    const viagensMes = tripsInMonth(input.viagens, now)
    const kmMes = kmRodadosNoMes(input, now)
    const esgMes = calculateTripEmissions(kmMes, input.combustivel)
    const historicoViagens = [...input.viagens]
      .filter(v => v.status !== 'REJEITADO')
      .sort((a, b) => timeValue(b.data) - timeValue(a.data))
      .slice(0, 12)
      .map(toTripSnapshot)

    return {
      placa: input.placa,
      marca: input.marca,
      modelo: input.modelo,
      ano: input.ano,
      idadeAnos: vehicleAgeYears(input.ano, now),
      combustivel: input.combustivel,
      combustivelLabel: COMBUSTIVEL_LABELS[input.combustivel],
      status: input.status,
      kmAcumulado: input.kmAtual,
      kmRodadosMes: kmMes,
      intervaloPreventivaKm: input.intervaloManutencaoKm,
      intervaloPreventivaDias: input.intervaloManutencaoDias,
      preventivaEsteMes: isPreventivaDueThisMonth(input, now, ultima),
      nivelRisco: insight.nivelRisco,
      ultimaManutencao: ultima
        ? { data: ultima.data, descricao: ultima.descricao, km: ultima.km, valor: ultima.valor }
        : null,
      manutencoesPendentes: input.manutencoes.filter(m => m.status === 'pendente' || m.status === 'em_andamento').length,
      manutencoesRecentes: [...input.manutencoes]
        .sort((a, b) => timeValue(b.data) - timeValue(a.data))
        .slice(0, 8)
        .map(m => ({
          descricao: m.descricao,
          tipo: m.tipo,
          data: m.data,
          status: m.status,
          pecas: m.pecas,
          valor: m.valor,
        })),
      custoManutencoesConcluidas: input.manutencoes
        .filter(m => m.status === 'concluida')
        .reduce((sum, m) => sum + (m.valor || 0), 0),
      viagensAtivas: ativas.map(toTripSnapshot),
      viagensMes: viagensMes.map(toTripSnapshot),
      historicoViagens,
      esgMes: { kgCo2: esgMes.kgCo2, arvores: esgMes.arvores, km: esgMes.km },
    }
  })
}

export function buildFleetTotals(snapshot: FleetVehicleSnapshot[], inputs: VehicleTelemetryInput[] = [], now = new Date()) {
  const mes = calculateFleetEmissions(collectEsgTrips(inputs, viagem => isSameMonth(viagem.data, now)))
  const acumulado = calculateFleetEmissions(collectEsgTrips(inputs))

  return {
    totalVeiculos: snapshot.length,
    disponiveis: snapshot.filter(item => item.status === 'disponivel').length,
    disponiveisParaViagem: snapshot.filter(item => item.status === 'disponivel' && item.viagensAtivas.length === 0).length,
    emViagem: snapshot.filter(item => item.status === 'em_viagem').length,
    emManutencao: snapshot.filter(item => item.status === 'em_manutencao').length,
    parados: snapshot.filter(item => item.status === 'parado').length,
    preventivaEsteMes: snapshot.filter(item => item.preventivaEsteMes).length,
    kmRodadosMes: snapshot.reduce((sum, item) => sum + item.kmRodadosMes, 0),
    custoManutencaoConcluida: snapshot.reduce((sum, item) => sum + item.custoManutencoesConcluidas, 0),
    osAbertas: snapshot.reduce((sum, item) => sum + item.manutencoesPendentes, 0),
    esgMes: {
      kgCo2: mes.kgCo2,
      toneladas: mes.toneladas,
      arvores: mes.arvores,
      kmTotal: mes.kmTotal,
      viagens: mes.viagens,
      label: mes.label,
      compensacao: mes.compensacao,
    },
    esgAcumulado: {
      kgCo2: acumulado.kgCo2,
      toneladas: acumulado.toneladas,
      arvores: acumulado.arvores,
      kmTotal: acumulado.kmTotal,
      viagens: acumulado.viagens,
      label: acumulado.label,
    },
  }
}

export function isMutationRequest(question: string): boolean {
  const normalized = normalizeQuestion(question)
  const asking = /^(quais|qual|quem|como|quando|onde|quantos|resumo|liste|mostrar|me (diga|informe|mostre)|o que)\b/.test(normalized)
    || /\b(precisam|precisa de|estao disponiveis|disponivel|saude da frota|mais rodado)\b/.test(normalized)
  if (asking && !/\b(agende|cadastre|crie|exclua|delete|apague|atualize|altere|salve|aprove|recuse)\b/.test(normalized)) {
    return false
  }

  return /\b(agende|agendar (manutencao|os|revisao)|crie uma? (os|manutencao|reserva|viagem)|criar (uma )?(os|manutencao|reserva)|cadastre|cadastrar (um |o )?veiculo|insira|inserir no banco|grave no banco|delete|deletar|exclua|excluir|apague|apagar|remova o veiculo|atualizar o status|alterar o status|altere o status|mude o status|muda o status|aprove a reserva|recuse a reserva|salve (no|a) |execute a alteracao)\b/.test(normalized)
}

export function buildChatPrompt(
  question: string,
  inputs: VehicleTelemetryInput[],
  history: IaChatMessage[] = [],
  now = new Date(),
  focusPlaca?: string,
): string {
  const snapshot = buildFleetSnapshot(inputs, now)
  const totais = buildFleetTotals(snapshot, inputs, now)
  const recent = history
    .slice(-12)
    .map(item => `${item.role === 'user' ? 'Usuário' : 'Assistente'}: ${item.content}`)
    .join('\n')

  return `Você é um Especialista Sênior em Inteligência de Frotas do FrotaMaq.
Atue ESTRITAMENTE em modo LEITURA (read-only): consulte, compare e explique os dados do snapshot. NUNCA execute, confirme, simule ou descreva como se tivesse feito alterações, inserções ou deleções no banco.

Se o usuário pedir qualquer mudança operacional (agendar OS, criar reserva, alterar status, excluir veículo, gravar KM, aprovar/recusar), recuse com educação: você é um assistente exclusivo para análise e consulta de dados. Oriente a usar as telas do FrotaMaq.

Respostas: extremamente claras, rápidas e precisas. Português. Markdown com **negrito** em placas e números e listas com hífen. Sem HTML, sem tabelas e sem links.
Não invente placa, KM, emissão, combustível, disponibilidade, peça ou status. Se o cadastro não tiver o dado, diga o que falta.

Como interpretar o snapshot:
- Disponível para viagem agora = status "disponivel" e viagensAtivas vazias.
- Preventiva deste mês = preventivaEsteMes true (intervalo em km/dias vencido ou caindo neste mês, ou OS aberta).
- Veículo mais rodado do mês = maior kmRodadosMes; cite historicoViagens/viagensMes.
- ESG = esgMes por veículo e totais.esgMes / totais.esgAcumulado (estimativa a partir do KM e do combustível).

Data de referência: ${now.toISOString().slice(0, 10)}
${focusPlaca ? `Veículo em foco na tela: ${focusPlaca}` : 'Visão da frota inteira da empresa.'}

Totais da empresa (operação + ESG):
${JSON.stringify(totais, null, 2)}

Snapshot completo da frota (veículos, preventiva, manutenções, viagens e ESG):
${JSON.stringify(snapshot, null, 2)}

${recent ? `Histórico da sessão (mantenha o contexto):\n${recent}\n` : ''}Pergunta livre do gestor:
${question.trim()}`
}

export function answerFleetQuestionHeuristic(
  question: string,
  inputs: VehicleTelemetryInput[],
  now = new Date(),
): string {
  if (isMutationRequest(question)) return IA_READ_ONLY_REFUSAL

  const snapshot = buildFleetSnapshot(inputs, now)
  const totais = buildFleetTotals(snapshot, inputs, now)
  const normalized = normalizeQuestion(question)

  if (snapshot.length === 0) {
    return 'Não há veículos cadastrados no contexto atual. Cadastre a frota para eu analisar manutenções e quilometragem.'
  }

  if (/manutencao urgente|precisam de manutencao|urgente/.test(normalized) && !/preventiva/.test(normalized)) {
    const urgentes = snapshot.filter(item => item.nivelRisco === 'alto' || item.manutencoesPendentes > 0 || item.status === 'em_manutencao')
    if (urgentes.length === 0) {
      return 'Nenhum veículo está com **manutenção urgente** agora. Siga o plano preventivo e atualize o KM após cada viagem.'
    }
    const linhas = urgentes.slice(0, 8).map(item =>
      `- **${item.placa}** (${item.marca} ${item.modelo}) — risco **${item.nivelRisco}**, ${item.kmAcumulado.toLocaleString('pt-BR')} km, ${item.manutencoesPendentes} OS em aberto`,
    )
    return `Veículos que pedem atenção imediata:\n\n${linhas.join('\n')}\n\nUse a tela de manutenções para abrir a OS — eu só consulto os dados.`
  }

  if (/preventiva|revisao preventiva/.test(normalized)) {
    const due = snapshot.filter(item => item.preventivaEsteMes)
    if (due.length === 0) {
      return 'Nenhum veículo está com **revisão preventiva** prevista ou vencida neste mês, segundo o intervalo de KM/dias e as OS em aberto.'
    }
    const linhas = due.slice(0, 8).map(item =>
      `- **${item.placa}** — ${item.marca} ${item.modelo}, ${item.kmAcumulado.toLocaleString('pt-BR')} km, intervalo **${item.intervaloPreventivaKm.toLocaleString('pt-BR')} km / ${item.intervaloPreventivaDias} dias**`,
    )
    return `Veículos com preventiva **este mês** (vencida ou no prazo do intervalo):\n\n${linhas.join('\n')}`
  }

  if (/consumiu mais|mais consum|quem rodou mais/.test(normalized) || (/mais rodado|mais km/.test(normalized) && /mes/.test(normalized))) {
    const ranked = [...snapshot].sort((a, b) => b.kmRodadosMes - a.kmRodadosMes || b.kmAcumulado - a.kmAcumulado)
    const top = ranked[0]
    if (!top) return 'Não foi possível identificar o veículo mais rodado.'
    if (top.kmRodadosMes <= 0) {
      return 'Não há viagens registradas neste mês no cadastro. Sem KM mensal, não consigo dizer quem mais rodou — registre as reservas/viagens para calcular.'
    }
    const viagens = (top.viagensMes.length > 0 ? top.viagensMes : top.historicoViagens).slice(0, 6)
    const linhas = viagens.map(item =>
      `- ${item.data.slice(0, 10)} — **${item.destino}** (${item.km.toLocaleString('pt-BR')} km, ${item.status})`,
    )
    return [
      `O veículo mais rodado do mês é **${top.placa}** (${top.marca} ${top.modelo}), com **${top.kmRodadosMes.toLocaleString('pt-BR')} km**.`,
      `Combustível: **${top.combustivelLabel}**. ESG do mês: **${formatCo2Mass(top.esgMes.kgCo2)} CO₂**.`,
      viagens.length > 0 ? `\nViagens:\n${linhas.join('\n')}` : '',
    ].join('\n')
  }

  if (/mais rodado|maior km|mais km/.test(normalized)) {
    const ranked = [...snapshot].sort((a, b) => b.kmAcumulado - a.kmAcumulado)
    const top = ranked[0]
    return `O maior odômetro da frota é **${top.placa}** (${top.marca} ${top.modelo}), com **${top.kmAcumulado.toLocaleString('pt-BR')} km** acumulados.`
  }

  if (/disponive|amanha|viajar|viagem agora/.test(normalized)) {
    const livres = snapshot.filter(item => item.status === 'disponivel' && item.viagensAtivas.length === 0)
    if (livres.length === 0) {
      return `Nenhum veículo está **disponível para viagem agora**. Situação: ${totais.disponiveis} com status disponível, ${totais.emViagem} em viagem, ${totais.emManutencao} em manutenção.`
    }
    const linhas = livres.slice(0, 8).map(item =>
      `- **${item.placa}** — ${item.marca} ${item.modelo} (${item.ano}), ${item.combustivelLabel}, ${item.kmAcumulado.toLocaleString('pt-BR')} km`,
    )
    return `**${livres.length}** veículo(s) disponíveis para viagem agora (status disponível e sem reserva ativa):\n\n${linhas.join('\n')}`
  }

  if (/mais antigo|mais velho|idade/.test(normalized)) {
    const ranked = [...snapshot].filter(item => item.ano > 0).sort((a, b) => a.ano - b.ano || b.idadeAnos - a.idadeAnos)
    const top = ranked[0]
    if (!top) {
      return 'O ano de fabricação não está preenchido no cadastro dos veículos. Atualize o campo **ano/ano_modelo** para eu indicar o mais antigo.'
    }
    return `O veículo mais antigo é **${top.placa}** (${top.marca} ${top.modelo}), ano **${top.ano}** (${top.idadeAnos} ano(s) de uso).`
  }

  if (/custo|gasto|valor/.test(normalized) && /manutenc/.test(normalized)) {
    if (totais.custoManutencaoConcluida <= 0) {
      return 'As ordens de manutenção desta frota estão sem **valor** preenchido. Não estimo custo sem esse dado no cadastro — registre valor de peças/mão de obra nas OS concluídas.'
    }
    return `Custo de manutenção já registrado (OS concluídas): **R$ ${totais.custoManutencaoConcluida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** em **${totais.totalVeiculos}** veículo(s), com **${totais.osAbertas}** OS em aberto.`
  }

  if (/combustivel|como reduzir/.test(normalized)) {
    const pesados = snapshot.filter(item => item.kmRodadosMes >= 800 || item.kmAcumulado >= KM_FAIXA_MEDIO)
    const placas = pesados.slice(0, 4).map(item => `**${item.placa}**`).join(', ')
    return [
      'Para reduzir o consumo de combustível da frota:',
      '- Planeje rotas e evite trechos ociosos; consolidar viagens curtas.',
      '- Mantenha calibragem dos pneus e revisões de filtros/injeção em dia.',
      '- Oriente motoristas a evitar marcha lenta prolongada e acelerações bruscas.',
      placas
        ? `- Foque primeiro em ${placas}, que concentram mais KM neste recorte.`
        : '- Comece pelos veículos de maior KM e pelos que rodam em estrada de terra.',
    ].join('\n')
  }

  if (/co2|emissao|esg|compensacao/.test(normalized)) {
    return [
      `**ESG da frota** (estimativa a partir do KM e do combustível):`,
      `- Este mês: **${formatCo2Mass(totais.esgMes.kgCo2)} CO₂** · ${formatArvores(totais.esgMes.arvores)} · ${totais.esgMes.kmTotal.toLocaleString('pt-BR')} km`,
      `- Acumulado nas viagens cadastradas: **${formatCo2Mass(totais.esgAcumulado.kgCo2)} CO₂** · ${formatArvores(totais.esgAcumulado.arvores)}`,
    ].join('\n')
  }

  if (/resumo|saude/.test(normalized)) {
    const alto = snapshot.filter(item => item.nivelRisco === 'alto').length
    const medio = snapshot.filter(item => item.nivelRisco === 'medio').length
    const baixo = snapshot.filter(item => item.nivelRisco === 'baixo').length
    const destaque = [...snapshot].sort((a, b) => NIVEL_RISCO_ORDEM[b.nivelRisco] - NIVEL_RISCO_ORDEM[a.nivelRisco])[0]
    return [
      `**Saúde da frota:** ${snapshot.length} veículo(s) no contexto atual.`,
      `- Disponíveis para viagem: **${totais.disponiveisParaViagem}**`,
      `- Em viagem: **${totais.emViagem}** · Em manutenção: **${totais.emManutencao}**`,
      `- Preventiva neste mês: **${totais.preventivaEsteMes}**`,
      `- Risco alto: **${alto}** · médio: **${medio}** · baixo: **${baixo}**`,
      `- ESG do mês: **${formatCo2Mass(totais.esgMes.kgCo2)} CO₂**`,
      destaque
        ? `\nDestaque: **${destaque.placa}** (${destaque.modelo}) com ${destaque.kmAcumulado.toLocaleString('pt-BR')} km e risco **${destaque.nivelRisco}**.`
        : '',
    ].join('\n')
  }

  return [
    `Analisei os **${totais.totalVeiculos}** veículos da empresa. Não há no cadastro um campo específico o bastante para responder essa pergunta com precisão matemática.`,
    `- Disponíveis: **${totais.disponiveis}** · Em viagem: **${totais.emViagem}** · Em manutenção: **${totais.emManutencao}**`,
    `- KM em viagens neste mês: **${totais.kmRodadosMes.toLocaleString('pt-BR')} km**`,
    'Pergunte por placa, disponibilidade, idade, KM do mês ou custo de OS — ou complete o cadastro se faltar valor/ano/viagem.',
  ].join('\n')
}

export async function askFleetAssistant(
  question: string,
  inputs: VehicleTelemetryInput[],
  history: IaChatMessage[] = [],
  options: AnalyzeOptions & { focusPlaca?: string } = {},
): Promise<IaChatReply> {
  const now = options.now ?? new Date()
  if (isMutationRequest(question)) {
    return { content: IA_READ_ONLY_REFUSAL, fonte: 'heuristica' }
  }

  const fallback = answerFleetQuestionHeuristic(question, inputs, now)
  const apiKey = options.apiKey === undefined ? getGeminiApiKey() : options.apiKey

  if (!isGeminiConfigured(apiKey ?? '')) {
    return { content: fallback, fonte: 'heuristica' }
  }

  try {
    const text = await requestGeminiRaw(
      buildChatPrompt(question, inputs, history, now, options.focusPlaca),
      apiKey!,
      options,
      'text',
    )
    if (!text) {
      return { content: fallback, fonte: 'heuristica', aviso: AVISO_CHAT_FALLBACK }
    }
    return { content: text, fonte: 'gemini' }
  } catch {
    return { content: fallback, fonte: 'heuristica', aviso: AVISO_CHAT_FALLBACK }
  }
}

function kmRodadosNoMes(input: VehicleTelemetryInput, now: Date): number {
  return tripsInMonth(input.viagens, now).reduce((sum, viagem) => sum + (viagem.kmIdaVolta || 0), 0)
}

function toTripSnapshot(viagem: ViagemTelemetria): FleetTripSnapshot {
  return {
    destino: viagem.destino,
    data: viagem.data,
    km: viagem.kmIdaVolta,
    status: viagem.status,
  }
}

function isSameMonth(iso: string, now: Date): boolean {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return false
  return data.getUTCFullYear() === now.getUTCFullYear() && data.getUTCMonth() === now.getUTCMonth()
}

function tripsInMonth(viagens: ViagemTelemetria[], now: Date): ViagemTelemetria[] {
  return viagens.filter(viagem => viagem.status !== 'REJEITADO' && isSameMonth(viagem.data, now))
}

function collectEsgTrips(
  inputs: VehicleTelemetryInput[],
  predicate?: (viagem: ViagemTelemetria) => boolean,
): Array<{ km: number; combustivel: TipoCombustivel }> {
  return inputs.flatMap(input =>
    input.viagens
      .filter(viagem => viagem.status !== 'REJEITADO')
      .filter(viagem => (predicate ? predicate(viagem) : true))
      .map(viagem => ({ km: viagem.kmIdaVolta || 0, combustivel: input.combustivel })),
  )
}

function isPreventivaDueThisMonth(
  input: VehicleTelemetryInput,
  now: Date,
  ultima?: ManutencaoTelemetria,
): boolean {
  if (input.manutencoes.some(item => item.status === 'pendente' || item.status === 'em_andamento')) return true

  const kmDesdeUltima = ultima?.km != null ? Math.max(0, input.kmAtual - ultima.km) : input.kmAtual
  if (input.kmAtual > 0 && kmDesdeUltima >= input.intervaloManutencaoKm) return true

  if (ultima?.data) {
    const proxima = new Date(ultima.data)
    if (!Number.isNaN(proxima.getTime())) {
      proxima.setUTCDate(proxima.getUTCDate() + input.intervaloManutencaoDias)
      if (proxima.getTime() <= now.getTime()) return true
      if (isSameMonth(proxima.toISOString(), now)) return true
    }
  }

  return false
}

function compareInsightRisk(a: IaInsight, b: IaInsight): number {
  return NIVEL_RISCO_ORDEM[b.nivelRisco] - NIVEL_RISCO_ORDEM[a.nivelRisco]
}

function acaoAgendar(veiculoId: string): AcaoSugeridaIa {
  return { tipo: 'agendar_manutencao', label: 'Agendar Manutenção', veiculoId }
}

function latestCompletedMaintenance(input: VehicleTelemetryInput): ManutencaoTelemetria | undefined {
  return input.manutencoes
    .filter(m => m.status === 'concluida')
    .sort((a, b) => timeValue(b.data) - timeValue(a.data))[0]
}

function recentTrips(viagens: ViagemTelemetria[], now: Date): ViagemTelemetria[] {
  const start = now.getTime() - JANELA_VIAGENS_DIAS * 24 * 60 * 60 * 1000
  return viagens.filter(v => {
    if (v.status === 'REJEITADO') return false
    const t = timeValue(v.data)
    return t >= start
  })
}

function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null
  const t = timeValue(iso)
  if (!t) return null
  return Math.floor((now.getTime() - t) / (1000 * 60 * 60 * 24))
}

function timeValue(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function buildHeuristicSummary(input: VehicleTelemetryInput, nivel: NivelRiscoIa, age: number): string {
  const km = input.kmAtual.toLocaleString('pt-BR')
  if (nivel === 'alto') {
    return `${input.placa} apresenta risco alto de parada: ${km} km e ${age} ano(s) de uso exigem preventiva imediata.`
  }
  if (nivel === 'medio') {
    return `${input.placa} está em faixa de atenção (${km} km). Antecipe a revisão para evitar corretiva.`
  }
  return `${input.placa} está em condição estável (${km} km). Mantenha o intervalo preventivo em dia.`
}

function buildHeuristicRecommendations(params: {
  input: VehicleTelemetryInput
  age: number
  kmDesdeUltima: number
  kmRestantesIntervalo: number
  destinosNaoPavimentados: ViagemTelemetria[]
  kmViagensRecentes: number
  pendentes: ManutencaoTelemetria[]
  ultimaConcluida?: ManutencaoTelemetria
}): string[] {
  const {
    input,
    age,
    kmDesdeUltima,
    kmRestantesIntervalo,
    destinosNaoPavimentados,
    kmViagensRecentes,
    pendentes,
    ultimaConcluida,
  } = params
  const recs: string[] = []

  if (pendentes.length > 0) {
    recs.push(`Há ${pendentes.length} ordem(ns) de manutenção em aberto — priorize a conclusão antes de novas viagens.`)
  }

  if (kmRestantesIntervalo <= 0 && input.kmAtual > 0) {
    recs.push(
      `O intervalo de ${input.intervaloManutencaoKm.toLocaleString('pt-BR')} km foi ultrapassado em ${Math.abs(kmRestantesIntervalo).toLocaleString('pt-BR')} km. Agendar preventiva imediatamente.`,
    )
  } else if (kmRestantesIntervalo <= input.intervaloManutencaoKm * 0.2) {
    recs.push(
      `Faltam ${Math.max(0, Math.round(kmRestantesIntervalo)).toLocaleString('pt-BR')} km para a próxima preventiva. Programar oficina nesta semana.`,
    )
  }

  if (destinosNaoPavimentados.length > 0) {
    recs.push(
      'Devido ao alto desgaste em estradas não pavimentadas, verificar pastilhas de freio em 500km.',
    )
  }

  if (input.kmAtual >= KM_FAIXA_ALTO) {
    recs.push(
      `Com ${input.kmAtual.toLocaleString('pt-BR')} km rodados, programar revisão completa (óleo, filtros, correias e suspensão) nos próximos 1.000 km.`,
    )
  } else if (input.kmAtual >= KM_FAIXA_MEDIO) {
    recs.push('Quilometragem em faixa intermediária: inspecionar pneus, fluídos e sistema de arrefecimento.')
  }

  if (age >= 8) {
    recs.push(`Veículo com ${age} anos. Avaliar correia dentada/kit de distribuição e possíveis pontos de corrosão.`)
  }

  if (kmViagensRecentes >= 800) {
    recs.push(
      `Viagens recentes somaram ${kmViagensRecentes.toLocaleString('pt-BR')} km. Inspecionar pneus e alinhamento antes da próxima saída.`,
    )
  }

  if (!ultimaConcluida) {
    recs.push('Não há manutenção concluída no histórico. Registrar uma preventiva de referência (óleo e filtros).')
  } else if (kmDesdeUltima >= input.intervaloManutencaoKm * 0.5) {
    recs.push(
      `Última manutenção concluída há ${kmDesdeUltima.toLocaleString('pt-BR')} km (${ultimaConcluida.descricao}).`,
    )
  }

  if (recs.length === 0) {
    recs.push('Telemetria estável. Manter o plano preventivo e atualizar a quilometragem após cada viagem.')
  }

  return recs.slice(0, 5)
}

export function buildVehiclePrompt(input: VehicleTelemetryInput, now: Date): string {
  return `${systemPrompt()}

Analise ESTE veículo e responda somente o JSON pedido.

Dados atuais (${now.toISOString().slice(0, 10)}):
${JSON.stringify(compactTelemetry(input), null, 2)}`
}

export function buildFleetPrompt(inputs: VehicleTelemetryInput[], now: Date): string {
  const compact = inputs.slice(0, 12).map(compactTelemetry)
  return `${systemPrompt()}

Analise a frota e foque no veículo de MAIOR risco. Responda somente o JSON pedido, referindo-se a esse veículo.

Data de referência: ${now.toISOString().slice(0, 10)}
Veículos:
${JSON.stringify(compact, null, 2)}`
}

function systemPrompt(): string {
  return `Você é um Especialista Sênior em Inteligência de Frotas do FrotaMaq.
Modo somente leitura: analise os dados e recomende consultas/ações para o gestor executar nas telas do sistema. Não afirme que alterou o banco.
Use idade do veículo, quilometragem, combustível, intervalo de preventiva, histórico de OS/peças, viagens e ESG.
Responda APENAS um JSON válido, sem markdown, no formato:
{
  "nivelRisco": "baixo" | "medio" | "alto",
  "resumo": "frase curta em português",
  "recomendacoes": [
    "recomendações detalhadas e acionáveis, ex: Devido ao alto desgaste em estradas não pavimentadas, verificar pastilhas de freio em 500km"
  ],
  "acoes": [{ "tipo": "agendar_manutencao", "label": "Agendar Manutenção" }]
}
Não invente placas, peças, KM ou falhas que os dados não sustentem. Seja objetivo e preciso.`
}

function compactTelemetry(input: VehicleTelemetryInput) {
  return {
    id: input.id,
    placa: input.placa,
    modelo: `${input.marca} ${input.modelo}`.trim(),
    marca: input.marca,
    ano: input.ano,
    kmAtual: input.kmAtual,
    status: input.status,
    combustivel: input.combustivel,
    intervaloManutencaoKm: input.intervaloManutencaoKm,
    intervaloManutencaoDias: input.intervaloManutencaoDias,
    manutencoes: input.manutencoes.slice(0, 8),
    viagens: input.viagens.slice(0, 8),
  }
}

async function requestGeminiInsightJson(
  prompt: string,
  apiKey: string,
  options: AnalyzeOptions,
): Promise<Partial<IaInsight> | null> {
  const text = await requestGeminiRaw(prompt, apiKey, options, 'json')
  return text ? parseGeminiInsightJson(text) : null
}

async function requestGeminiRaw(
  prompt: string,
  apiKey: string,
  options: AnalyzeOptions,
  mode: 'json' | 'text',
): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return null

  const timeoutMs = options.timeoutMs ?? 15_000
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: mode === 'json' ? 1024 : 1600,
      ...(mode === 'json' ? { responseMimeType: 'application/json' } : {}),
    },
  })

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body,
        },
      )
      if (!response.ok) continue

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('\n') ?? ''
      const cleaned = stripMarkdownFence(text)
      if (cleaned) return cleaned
    } catch {
      continue
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const fenced = trimmed.match(/```(?:json|markdown|md)?\s*([\s\S]*?)```/i)
  return (fenced?.[1] ?? trimmed).trim()
}

function mergeGeminiInsight(base: IaInsight, generated: Partial<IaInsight>, fonte: FonteAnaliseIa): IaInsight {
  const recomendacoes = (generated.recomendacoes ?? []).map(r => r.trim()).filter(Boolean)
  return {
    ...base,
    nivelRisco: generated.nivelRisco ?? base.nivelRisco,
    resumo: generated.resumo?.trim() || base.resumo,
    recomendacoes: recomendacoes.length > 0 ? recomendacoes.slice(0, 6) : base.recomendacoes,
    acoes: [acaoAgendar(base.veiculoId)],
    fonte,
  }
}

function extractJsonBlock(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()

  if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) return candidate.slice(start, end + 1)
  return null
}

function normalizeNivel(value: unknown): NivelRiscoIa | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (normalized === 'medio' || normalized === 'medium') return 'medio'
  if (NIVEIS_VALIDOS.includes(normalized as NivelRiscoIa)) return normalized as NivelRiscoIa
  return null
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
