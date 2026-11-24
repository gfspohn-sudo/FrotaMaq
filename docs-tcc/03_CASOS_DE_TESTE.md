# Casos de Teste — FrotaMaq

Parte A: roteiro funcional para banca/demonstração.  
Parte B: evidências da suíte automatizada extraídas de `tests/` (Vitest 5).

---

## Parte A — Casos de teste funcionais

| ID | Título | Pré-condição | Passos | Resultado esperado |
|---|---|---|---|---|
| **TC01** | Login válido | Usuário gestor cadastrado | Informar e-mail/senha → Entrar | Redireciona a `/`; KPIs “Total de veículos”, “Em manutenção”, “Parados” |
| **TC02** | Login inválido | — | Senha errada | Mensagem de falha; permanece em `/login` |
| **TC03** | Recuperar senha | E-mail preenchido | “Esqueci a senha?” | Feedback de envio (ou erro se e-mail vazio) |
| **TC04** | Sem Google | Tela de login | Inspecionar botões | **Não** existe “Entrar com Google” |
| **TC05** | Cadastro por convite | Chave `motorista`/`mecanico` | Signup com chave | Perfil e `empresa_id` definidos pela chave |
| **TC06** | Isolamento tenant | Dois gestores de empresas distintas | Listar veículos | Cada um vê só o próprio `empresa_id` |
| **TC07** | Motorista sem OS | Perfil motorista | Abrir `/manutencoes` | Redirect `/` (`requireMaintenance`) |
| **TC08** | Cadastrar veículo | Gestor | Preencher placa, modelo, KM | Veículo na lista; placa única no tenant |
| **TC09** | Empty state frota | Empresa sem veículos | Abrir `/veiculos` | Empty + “Cadastrar Primeiro Veículo”; **sem** “Popular Veículos de Teste” |
| **TC10** | Nova OS no desktop | Gestor | `/manutencoes` → Nova manutenção | Modal abre; OS aparece na lista |
| **TC11** | Solicitar reserva | Motorista | Destino, data, km &gt; 0 | Status `PENDENTE`; prévia ESG |
| **TC12** | Recusa sem motivo | Gestor | Recusar reserva em branco | Bloqueio: “Informe o motivo da recusa.” |
| **TC13** | Recusa com motivo | Gestor | Informar motivo | Status `REJEITADO`; motorista vê o texto |
| **TC14** | Margem preventiva | Veículo a 400 km da OS | Solicitar viagem de 200 km | Bloqueio (margem 500 km) |
| **TC15** | Calculadora ESG | Viagem 100 km diesel | Ver `EsgTripEstimate` / card | 25 L; 67 kg CO₂; ~0,47 árvore |
| **TC16** | Simulador 100% elétrico | KM mensal 1000 diesel | Slider 100% elétrico | CO₂ alternativo 0; economia R$ &gt; 0 |
| **TC17** | Score ESG vazio | Sem frota/OS/viagens | Dashboard gestor | Nota 50 — “Atenção — Oportunidade de Otimização” |
| **TC18** | Score excelente | Preventivas em dia + mix preventivo + EV | Dashboard | Nota ≥ 80 — “Excelente — Operação Sustentável” |
| **TC19** | Co-Piloto consulta | Gestor | “Quais veículos estão disponíveis?” | Resposta com placas do snapshot |
| **TC20** | Guardrail de mutação | Chat IA | “Agende uma OS no ABC-1D23” | Recusa `IA_READ_ONLY_REFUSAL`; banco inalterado |
| **TC21** | Fallback IA | Sem rede Gemini | Mesma pergunta | Heurística local (risco baixo/médio/alto) |
| **TC22** | Relatório ESG PDF | Gestor | Relatórios → ESG → PDF | Download `.pdf` + toast de sucesso |
| **TC23** | Relatório CSV | Gestor | Frota → CSV | Download `.csv` |
| **TC24** | Auditoria | Após criar viagem | Timeline em Reservas | Evento `viagem_criada` |
| **TC25** | SPA F5 no Pages | Deploy `/FrotaMaq/reservas` | Recarregar | `404.html` restaura a rota (não 404 GitHub) |

---

## Parte B — Evidências dos testes automatizados

**Comandos:** `npx vitest run` (alias `npm run test:ci`) e `npm run test:security`.  
**Resultado da auditoria de 24/11/2026:** 45 arquivos, **237 testes passando**; segurança **14/14**.

Playwright (`tests/e2e/login-dashboard.spec.ts`) cobre TC01 + ausência do botão Google. Requer `npx playwright install chromium` neste ambiente.

### B.1 Os 14 testes de segurança (`tests/security/`)

| # | Arquivo | Caso | Classe |
|---|---|---|---|
| 1 | `idor.test.ts` | Políticas RLS filtram `empresa_id` | IDOR |
| 2 | `idor.test.ts` | Aplicação recusa consulta/update cross-tenant | IDOR |
| 3 | `idor.test.ts` | Anônimo não lê veículos/reservas (live) | IDOR |
| 4 | `idor.test.ts` | UPDATE cross-tenant retorna 0 linhas (live) | IDOR |
| 5 | `idor.test.ts` | Gestor autenticado não lista outra empresa (live) | IDOR |
| 6 | `crypto.test.ts` | Sem `VITE_SUPABASE_SERVICE_ROLE_KEY` no client | Segredos |
| 7 | `crypto.test.ts` | Service role só no seed server-side | Segredos |
| 8 | `crypto.test.ts` | Senha não persiste em `localStorage` | Credencial |
| 9 | `injection.test.ts` | PostgREST `eq.` parametrizado | SQLi |
| 10 | `injection.test.ts` | React escapa `<script>` | XSS |
| 11 | `injection.test.ts` | Sem sinks + `safeHttpsUrl` | XSS |
| 12 | `bot-protection.test.ts` | Trata HTTP 429 após limite | Brute force |
| 13 | `bot-protection.test.ts` | GoTrue 400/429 em rajada (live) | Brute force |
| 14 | `bot-protection.test.ts` | Bot não obtém sessão | Brute force |

Live tests usam `skipIf` se a URL não for projeto Supabase real; erros de transporte não derrubam a suíte estática.

### B.2 Testes unitários e de integração (amostra alinhada aos diferenciais)

| Arquivo | O que prova |
|---|---|
| `tests/unit/utils/esgCalculator.test.ts` | Diesel 100 km → 67 kg; elétrico 0 kg; parse de KM |
| `tests/unit/utils/esgTransition.test.ts` | 100% elétrico zera CO₂; percentual 50%; KM zero |
| `tests/unit/utils/esgFleetScore.test.ts` | Excelente / crítico / neutro 50 |
| `tests/unit/domain/EsgAlertService.test.ts` | Marcos 50–2500 kg |
| `tests/unit/services/aiService.test.ts` | `isMutationRequest`, heurística, parse Gemini |
| `tests/unit/domain/ReservaValidationService.test.ts` | Motivo e margem 500 km |
| `tests/integration/SolicitarReservaUseCase.test.ts` | Fluxo de solicitação |
| `tests/integration/AtualizarStatusReservaUseCase.test.ts` | Aprovação/recusa |
| `tests/integration/TenantIsolation.test.ts` | Isolamento `empresa_id` |
| `tests/integration/PermissionService.test.ts` | RBAC dos 4 perfis |
| `tests/unit/lib/pdfExecutiveReport.test.ts` | PDF |
| `tests/unit/application/AuditTrailService.test.ts` | Auditoria |
| `tests/unit/lib/supabaseErrors.test.ts` | JWT, RLS, 521, `getAuthRedirectUrl` |

Demais arquivos em `tests/unit/domain/*` cobrem `Veiculo`, `ManutencaoValorTotal`, `Money`, `Usuario`, convites, disponibilidade, dashboards e relatórios.

### B.3 CI

- `ci.yml`: `npm ci` → `npm run build` → `npm run test:ci`
- `security-tests.yml`: `npm audit --audit-level=critical` (não bloqueia) + `npm run test:security`
- `deploy.yml`: Vite com `VITE_BASE_PATH=/FrotaMaq/` → GitHub Pages
