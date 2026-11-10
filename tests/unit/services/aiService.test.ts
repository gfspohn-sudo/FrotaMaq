import { describe, expect, it, vi } from 'vitest'
import {
  IA_QUICK_SUGGESTIONS,
  analyzeFleetTelemetry,
  analyzeVehicleHeuristic,
  analyzeVehicleTelemetry,
  answerFleetQuestionHeuristic,
  askFleetAssistant,
  buildChatPrompt,
  buildFleetSnapshot,
  buildVehiclePrompt,
  buildVehicleTelemetry,
  isGeminiConfigured,
  isMutationRequest,
  parseGeminiInsightJson,
  vehicleAgeYears,
  IA_READ_ONLY_REFUSAL,
} from '@/services/aiService'
import type { Manutencao, Reserva, Veiculo } from '@/types/database'

const NOW = new Date('2026-10-27T12:00:00.000Z')

function makeVeiculo(overrides: Partial<Veiculo> = {}): Veiculo {
  return {
    id: 'veh-1',
    empresa_id: 'emp-1',
    nome_exibicao: 'Volvo FH 540',
    placa: 'ABC-1D23',
    marca: 'Volvo',
    modelo: 'FH 540',
    ano: 2024,
    ano_modelo: 2024,
    quilometragem_atual: 12_000,
    km_atual: 12_000,
    intervalo_manutencao_km: 10_000,
    intervalo_manutencao_dias: 180,
    status: 'disponivel',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeManutencao(overrides: Partial<Manutencao> = {}): Manutencao {
  return {
    id: 'mnt-1',
    empresa_id: 'emp-1',
    veiculo_id: 'veh-1',
    descricao: 'Troca de óleo',
    valor_total: 800,
    data_manutencao: '2026-09-01T10:00:00.000Z',
    tipo: 'preventiva',
    status: 'concluida',
    km_atual_veiculo: 8_000,
    created_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeViagem(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: 'res-1',
    empresa_id: 'emp-1',
    veiculo_id: 'veh-1',
    motorista_id: 'usr-1',
    data_viagem: '2026-10-20T08:00:00.000Z',
    destino: 'Campinas',
    km_ida_volta: 240,
    status: 'CONCLUIDA',
    observacao_gestor: null,
    created_at: '2026-10-20T08:00:00.000Z',
    updated_at: '2026-10-20T18:00:00.000Z',
    ...overrides,
  }
}

describe('isGeminiConfigured', () => {
  it('rejeita chave vazia ou placeholder', () => {
    expect(isGeminiConfigured('')).toBe(false)
    expect(isGeminiConfigured('sua-chave-gemini-aqui')).toBe(false)
    expect(isGeminiConfigured('short')).toBe(false)
  })

  it('aceita chave com formato de API', () => {
    expect(isGeminiConfigured('AIzaSyDummyKeyValue123')).toBe(true)
  })
})

describe('vehicleAgeYears', () => {
  it('calcula a idade com o ano de referência', () => {
    expect(vehicleAgeYears(2022, NOW)).toBe(4)
    expect(vehicleAgeYears(2026, NOW)).toBe(0)
  })
})

describe('parseGeminiInsightJson', () => {
  it('lê JSON puro e JSON em bloco markdown', () => {
    expect(parseGeminiInsightJson('{"nivelRisco":"alto","resumo":"Atenção","recomendacoes":["Freios"]}')).toMatchObject({
      nivelRisco: 'alto',
      resumo: 'Atenção',
      recomendacoes: ['Freios'],
    })

    const fenced = parseGeminiInsightJson('```json\n{"nivel_risco":"medio","recomendacoes":["Óleo"]}\n```')
    expect(fenced?.nivelRisco).toBe('medio')
    expect(fenced?.recomendacoes).toEqual(['Óleo'])
  })

  it('ignora texto inválido', () => {
    expect(parseGeminiInsightJson('não é json')).toBeNull()
  })
})

describe('analyzeVehicleHeuristic', () => {
  it('classifica km baixa como risco baixo', () => {
    const telemetry = buildVehicleTelemetry(
      makeVeiculo({ quilometragem_atual: 12_000, km_atual: 12_000, ano: 2024, ano_modelo: 2024 }),
      [makeManutencao({ km_atual_veiculo: 8_000 })],
      [makeViagem()],
    )
    const insight = analyzeVehicleHeuristic(telemetry, NOW)
    expect(insight.nivelRisco).toBe('baixo')
    expect(insight.acoes[0]?.label).toBe('Agendar Manutenção')
  })

  it('classifica km intermediária como risco médio', () => {
    const telemetry = buildVehicleTelemetry(
      makeVeiculo({ quilometragem_atual: 85_000, km_atual: 85_000, ano: 2023, ano_modelo: 2023 }),
      [makeManutencao({ km_atual_veiculo: 80_000 })],
      [makeViagem({ km_ida_volta: 900, data_viagem: '2026-10-18T08:00:00.000Z' })],
    )
    const insight = analyzeVehicleHeuristic(telemetry, NOW)
    expect(insight.nivelRisco).toBe('medio')
    expect(insight.recomendacoes.join(' ')).toMatch(/pneus|fluídos|fluidos|alinhamento/i)
  })

  it('classifica km alta como risco alto', () => {
    const telemetry = buildVehicleTelemetry(
      makeVeiculo({ quilometragem_atual: 180_000, km_atual: 180_000, ano: 2016, ano_modelo: 2016 }),
      [makeManutencao({ km_atual_veiculo: 160_000 })],
      [],
    )
    const insight = analyzeVehicleHeuristic(telemetry, NOW)
    expect(insight.nivelRisco).toBe('alto')
    expect(insight.recomendacoes.join(' ')).toMatch(/revisão completa/i)
  })

  it('recomenda pastilhas após viagens em estrada não pavimentada', () => {
    const telemetry = buildVehicleTelemetry(
      makeVeiculo({ quilometragem_atual: 42_000, km_atual: 42_000 }),
      [makeManutencao({ km_atual_veiculo: 38_000 })],
      [makeViagem({ destino: 'Fazenda — estrada de terra', km_ida_volta: 180 })],
    )
    const insight = analyzeVehicleHeuristic(telemetry, NOW)
    expect(insight.recomendacoes.join(' ')).toMatch(/pastilhas de freio em 500km/i)
    expect(insight.nivelRisco).not.toBe('baixo')
  })
})

describe('analyzeVehicleTelemetry', () => {
  it('usa heurística quando a chave de API não está configurada', async () => {
    const telemetry = buildVehicleTelemetry(makeVeiculo(), [makeManutencao()], [])
    const insight = await analyzeVehicleTelemetry(telemetry, { apiKey: '', now: NOW })
    expect(insight.fonte).toBe('heuristica')
    expect(insight.aviso).toBeUndefined()
  })

  it('cai no fallback amigável se a API falhar', async () => {
    const telemetry = buildVehicleTelemetry(
      makeVeiculo({ quilometragem_atual: 85_000, km_atual: 85_000 }),
      [makeManutencao({ km_atual_veiculo: 80_000 })],
      [makeViagem()],
    )
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    const insight = await analyzeVehicleTelemetry(telemetry, {
      apiKey: 'AIzaSyDummyKeyValue123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: NOW,
    })
    expect(insight.fonte).toBe('heuristica')
    expect(insight.aviso).toMatch(/IA online está indisponível/i)
    expect(insight.nivelRisco).toBe('medio')
  })

  it('usa o JSON do Gemini quando a API responde', async () => {
    const telemetry = buildVehicleTelemetry(makeVeiculo(), [makeManutencao()], [])
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"nivelRisco":"alto","resumo":"Diagnóstico Gemini","recomendacoes":["Verificar pastilhas de freio em 500km"]}',
            }],
          },
        }],
      }),
    })

    const insight = await analyzeVehicleTelemetry(telemetry, {
      apiKey: 'AIzaSyDummyKeyValue123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: NOW,
    })

    expect(insight.fonte).toBe('gemini')
    expect(insight.nivelRisco).toBe('alto')
    expect(insight.resumo).toBe('Diagnóstico Gemini')
    expect(insight.recomendacoes[0]).toMatch(/pastilhas/i)
    expect(buildVehiclePrompt(telemetry, NOW)).toMatch(/Especialista Sênior em Inteligência de Frotas/i)
  })
})

describe('analyzeFleetTelemetry', () => {
  it('destaca o veículo de maior risco da frota', async () => {
    const baixo = buildVehicleTelemetry(
      makeVeiculo({ id: 'v-low', placa: 'LOW-0001' }),
      [makeManutencao({ veiculo_id: 'v-low', km_atual_veiculo: 8_000 })],
      [],
    )
    const alto = buildVehicleTelemetry(
      makeVeiculo({
        id: 'v-high',
        placa: 'HIG-0001',
        quilometragem_atual: 180_000,
        km_atual: 180_000,
        ano: 2014,
        ano_modelo: 2014,
      }),
      [makeManutencao({ veiculo_id: 'v-high', km_atual_veiculo: 150_000 })],
      [makeViagem({ veiculo_id: 'v-high', destino: 'Ramal de cascalho' })],
    )

    const fleet = await analyzeFleetTelemetry([baixo, alto], { apiKey: '', now: NOW })
    expect(fleet.destaque?.placa).toBe('HIG-0001')
    expect(fleet.destaque?.nivelRisco).toBe('alto')
    expect(fleet.outros.some(item => item.placa === 'LOW-0001')).toBe(true)
  })
})

describe('assistente de frota', () => {
  const baixo = () => buildVehicleTelemetry(
    makeVeiculo({ id: 'v-low', placa: 'LOW-0001', quilometragem_atual: 12_000, km_atual: 12_000 }),
    [makeManutencao({ veiculo_id: 'v-low', km_atual_veiculo: 8_000 })],
    [],
  )
  const alto = () => buildVehicleTelemetry(
    makeVeiculo({
      id: 'v-high',
      placa: 'HIG-0001',
      quilometragem_atual: 180_000,
      km_atual: 180_000,
      ano: 2014,
      ano_modelo: 2014,
      status: 'em_manutencao',
    }),
    [makeManutencao({ veiculo_id: 'v-high', km_atual_veiculo: 150_000 })],
    [makeViagem({ veiculo_id: 'v-high', destino: 'Campinas', km_ida_volta: 1_200, data_viagem: '2026-10-12T08:00:00.000Z' })],
  )

  it('expõe as sugestões rápidas de consulta operacional', () => {
    expect(IA_QUICK_SUGGESTIONS).toContain('Quais veículos estão disponíveis para viagem agora?')
    expect(IA_QUICK_SUGGESTIONS).toContain('Quais veículos precisam de revisão preventiva este mês?')
    expect(IA_QUICK_SUGGESTIONS).toContain('Qual o resumo geral de saúde da frota?')
    expect(IA_QUICK_SUGGESTIONS).toContain('Qual o veículo mais rodado do mês e suas viagens?')
  })

  it('lista veículos de manutenção urgente no fallback local', () => {
    const answer = answerFleetQuestionHeuristic('Quais veículos precisam de manutenção urgente?', [baixo(), alto()], NOW)
    expect(answer).toMatch(/HIG-0001/)
    expect(answer).toMatch(/urgente|alto|Agendar/i)
  })

  it('identifica o veículo mais rodado no mês e lista as viagens', () => {
    const answer = answerFleetQuestionHeuristic('Qual o veículo mais rodado do mês e suas viagens?', [baixo(), alto()], NOW)
    expect(answer).toMatch(/HIG-0001/)
    expect(answer).toMatch(/1[.,]200|1200/)
    expect(answer).toMatch(/Campinas/)
  })

  it('resume a saúde da frota', () => {
    const answer = answerFleetQuestionHeuristic('Qual o resumo geral de saúde da frota?', [baixo(), alto()], NOW)
    expect(answer).toMatch(/Risco alto: \*\*1\*\*/)
    expect(answer).toMatch(/HIG-0001/)
    expect(answer).toMatch(/ESG/)
  })

  it('monta o prompt de chat read-only com snapshot enriquecido', () => {
    const prompt = buildChatPrompt(
      'Quais veículos estão disponíveis para viagem agora?',
      [baixo(), alto()],
      [{ id: 'm1', role: 'user', content: 'Olá' }],
      NOW,
      'HIG-0001',
    )
    expect(prompt).toMatch(/Especialista Sênior em Inteligência de Frotas/)
    expect(prompt).toMatch(/LEITURA|read-only/)
    expect(prompt).toMatch(/Não invente/)
    expect(prompt).toMatch(/HIG-0001/)
    expect(prompt).toMatch(/LOW-0001/)
    expect(prompt).toMatch(/combustivel/)
    expect(prompt).toMatch(/intervaloPreventivaKm/)
    expect(prompt).toMatch(/manutencoesRecentes/)
    expect(prompt).toMatch(/historicoViagens/)
    expect(prompt).toMatch(/esgMes/)
    expect(prompt).toMatch(/esgAcumulado/)
    expect(prompt).toMatch(/Histórico da sessão/)
    expect(prompt).toMatch(/disponíveis para viagem agora/)
  })

  it('inclui todos os veículos no snapshot, com combustível e última manutenção', () => {
    const snapshot = buildFleetSnapshot([baixo(), alto()], NOW)
    expect(snapshot).toHaveLength(2)
    const high = snapshot.find(item => item.placa === 'HIG-0001')
    expect(high?.combustivel).toBe('diesel')
    expect(high?.kmAcumulado).toBe(180_000)
    expect(high?.ultimaManutencao?.descricao).toMatch(/óleo/i)
    expect(high?.viagensAtivas).toEqual([])
    expect(high?.kmRodadosMes).toBe(1_200)
    expect(high?.viagensMes).toHaveLength(1)
    expect(high?.intervaloPreventivaKm).toBe(10_000)
    expect(high?.combustivelLabel).toBe('Diesel')
    expect(high?.manutencoesRecentes.length).toBeGreaterThan(0)
    expect(high?.historicoViagens.length).toBeGreaterThan(0)
    expect(high?.esgMes.kgCo2).toBeGreaterThan(0)
    expect(high?.preventivaEsteMes).toBe(true)
  })

  it('recusa pedidos de alteração no banco (somente leitura)', () => {
    expect(isMutationRequest('Agendar manutenção para HIG-0001')).toBe(true)
    expect(isMutationRequest('Excluir o veículo LOW-0001')).toBe(true)
    expect(isMutationRequest('Quais veículos estão disponíveis para viagem agora?')).toBe(false)
    const answer = answerFleetQuestionHeuristic('Agendar manutenção para HIG-0001', [alto()], NOW)
    expect(answer).toBe(IA_READ_ONLY_REFUSAL)
    expect(answer).toMatch(/somente leitura/i)
  })

  it('responde perguntas livres: mais antigo, disponíveis e custo', () => {
    expect(answerFleetQuestionHeuristic('Qual o veículo mais antigo?', [baixo(), alto()], NOW)).toMatch(/HIG-0001/)
    expect(answerFleetQuestionHeuristic('Quais veículos estão disponíveis para viagem agora?', [baixo(), alto()], NOW)).toMatch(/LOW-0001/)
    expect(answerFleetQuestionHeuristic('Qual o custo estimado de manutenção da frota?', [baixo(), alto()], NOW)).toMatch(/R\$/)
  })

  it('não inventa consumo mensal quando não há viagens no mês', () => {
    const answer = answerFleetQuestionHeuristic('Qual carro consumiu mais este mês?', [baixo()], NOW)
    expect(answer).toMatch(/não há viagens|sem KM mensal/i)
  })

  it('usa heurística no chat quando a chave não está configurada', async () => {
    const reply = await askFleetAssistant('Quais veículos precisam de manutenção urgente?', [alto()], [], { apiKey: '', now: NOW })
    expect(reply.fonte).toBe('heuristica')
    expect(reply.content).toMatch(/HIG-0001/)
  })

  it('usa o texto do Gemini no chat quando a API responde', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '**HIG-0001** deve ir para oficina hoje.' }] } }],
      }),
    })
    const reply = await askFleetAssistant('Quais veículos precisam de manutenção urgente?', [alto()], [], {
      apiKey: 'AIzaSyDummyKeyValue123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: NOW,
    })
    expect(reply.fonte).toBe('gemini')
    expect(reply.content).toMatch(/HIG-0001/)
  })
})
