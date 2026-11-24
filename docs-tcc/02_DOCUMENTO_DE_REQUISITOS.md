# Documento de Requisitos — FrotaMaq

Extraído das rotas (`src/App.tsx`), permissões (`PermissionService` e subclasses de `Usuario`), telas e serviços. Isolamento por `empresa_id` (RLS + `TenantScopeService`).

---

## 1. Atores e governança RBAC

| Ator | Perfil (`perfil_usuario`) | Empresa | Capacidades reais no código |
|---|---|---|---|
| **Super Admin** | `super_admin` | Todas | Empresas, frota, OS, aprovar reserva, relatórios, auditoria, alertas. **Não** solicita reserva. |
| **Gestor** | `gestor` | Própria | CRUD frota/OS, aprovar/recusar viagem (motivo obrigatório), ESG, simulador, IA, financeiro, alertas. |
| **Mecânico** | `mecanico` | Própria | Registrar/concluir OS, atualizar KM, dashboard, histórico, alertas. Solicita acesso a relatório. Sem CRUD de veículos nem reservas. |
| **Motorista** | `motorista` | Própria | Somente leitura da frota disponível, **solicita** reserva, vê ESG da viagem. Sem OS, alertas globais, simulador/score no dashboard. |

Instanciação: `UsuarioFactory.fromProfile` → `PermissionService.toViewModel()` → `usePermissions()`. Telas **não** devem testar `perfil === 'gestor'` diretamente.

---

## 2. Requisitos funcionais

| ID | Requisito | Evidência |
|---|---|---|
| **RF01** | Autenticar com e-mail e senha | `LoginPage`, `signInWithPassword` |
| **RF02** | Recuperar senha por e-mail | `resetPasswordForEmail` + `getAuthRedirectUrl('login')` |
| **RF03** | Lembrar e-mail no dispositivo | `localStorage` `frotamaq_remember_email` |
| **RF04** | Cadastrar com chave de convite (motorista/mecânico) | `ValidarChaveConviteUseCase`, `chaves_convite` |
| **RF05** | Proteger rotas; anônimo vai a `/login` | `ProtectedRoute` |
| **RF06** | Isolar dados por `empresa_id` | RLS + `TenantScopeService` |
| **RF07** | Super admin filtrar empresa ou “todas” | `TenantSelector` |
| **RF08** | CRUD de empresas e geração de chaves | `EmpresasPage` |
| **RF09** | Listar, buscar e filtrar veículos por status | `VehiclesPage` |
| **RF10** | Cadastrar/editar veículo (placa única no tenant) | `VehicleFormModal` |
| **RF11** | Detalhe, KM, OS, IA e exclusão | `VehicleDetailPage` |
| **RF12** | Motorista solicitar reserva (data, destino, km, mapa) | `ReservasPage` |
| **RF13** | Gestor aprovar ou recusar **com motivo** | `validarMotivoRecusa` |
| **RF14** | Impedir viagem que estoure `proxima_manutencao_km − 500` | `ReservaValidationService` |
| **RF15** | Finalizar viagem e atualizar KM | `FinalizarViagemUseCase` |
| **RF16** | Registrar OS preventiva/corretiva/preditiva | `MaintenanceFormModal` |
| **RF17** | Concluir OS e auditar liberação | `ConcluirManutencaoUseCase` |
| **RF18** | Dashboard com KPIs de frota | `DashboardPage` |
| **RF19** | **Calculadora ESG** (kg CO₂, t, árvores) | `esgCalculator.ts`, `EsgDashboardCard`, `EsgTripEstimate` |
| **RF20** | **Simulador de Transição & Economia (ROI Verde)** | `esgTransition.ts`, `EnergyTransitionSimulator` |
| **RF21** | **Índice FrotaMaq ESG & Eficiência (0–100)** | `esgFleetScore.ts`, `EsgFleetScoreCard` |
| **RF22** | Alertas preventivos (≤ 5 dias ou ≤ 500 km) | `PreventiveAlertService` |
| **RF23** | Alertas priorizados (7/3 dias; 500/200 km) | `FleetPriorityAlertService` |
| **RF24** | Atraso de viagem `max(2 h, km/50)` | `TripDelayAlertService` |
| **RF25** | Alertas ESG nos marcos 50/100/500/1000/2500 kg | `EsgAlertService` |
| **RF26** | Central de notificações (~30 s) | `NotificationBell` |
| **RF27** | Co-Piloto IA somente leitura (Gemini) | `aiService.ts`, `IaAssistantChat` |
| **RF28** | Recusar mutação na IA | `isMutationRequest`, `IA_READ_ONLY_REFUSAL` |
| **RF29** | Fallback heurístico se Gemini falhar | `answerFleetQuestionHeuristic` |
| **RF30** | Relatórios PDF/CSV (frota, ESG, manutenções) | `ExecutiveExportCard` |
| **RF31** | Pedido de acesso a relatório | `solicitacoes_relatorio` |
| **RF32** | Trilha de auditoria | `audit_logs` (`viagem_criada`, `veiculo_em_manutencao`, `veiculo_liberado`) |
| **RF33** | Tema claro/escuro e i18n pt-BR/en | `ThemeContext`, `I18nContext` |
| **RF34** | Logout e menu “Mais” | `MorePage` |

OAuth Google **não** é requisito vigente (botão e handler removidos). Seed “Popular veículos de teste” **não** é requisito de produção (botão removido da UI).

---

## 3. Requisitos não funcionais

| ID | Categoria | Implementação |
|---|---|---|
| **RNF01** | Segurança — RLS | Policies em `empresas`, `usuarios`, `veiculos`, `manutencoes`, `reservas`, `chaves_convite`, `solicitacoes_relatorio`, `audit_logs` |
| **RNF02** | Segurança — IDOR | RLS + tenant na aplicação + 5 testes em `idor.test.ts` |
| **RNF03** | Segurança — XSS | React escapa texto; varredura sem `dangerouslySetInnerHTML`; `safeHttpsUrl` |
| **RNF04** | Segurança — SQLi | Filtros PostgREST `eq.` |
| **RNF05** | Segurança — brute force | Tratamento 400/429 GoTrue (`bot-protection.test.ts`) |
| **RNF06** | Segredos | `service_role` nunca com prefixo `VITE_`; senha fora do `localStorage` |
| **RNF07** | Resiliência Supabase | Retry, timeout, banner; rotas não bloqueiam em “Failed to fetch” |
| **RNF08** | Resiliência IA | Heurística local se a API Gemini falhar |
| **RNF09** | Resiliência geo | Nominatim → Photon; OSRM → Haversine |
| **RNF10** | SPA GitHub Pages | `base /FrotaMaq/`, `404.html` + `history.replaceState` |
| **RNF11** | SPA Vercel | `vercel.json` rewrite `/(.*) → /index.html` |
| **RNF12** | Usabilidade | Empty states, skeletons, toasts, BottomNav, Sidebar |
| **RNF13** | Desempenho percebido | Cache de snapshot; polling de notificações limitado |
| **RNF14** | CI/CD | GitHub Actions `ci.yml`, `security-tests.yml`, `deploy.yml` (Node 22) |
| **RNF15** | Qualidade | Vitest 237 testes + 14 de segurança; `tsc -b` no build |

---

## 4. Regras de negócio

| ID | Regra | Código |
|---|---|---|
| **RN01** | Placa única por empresa | `UNIQUE (empresa_id, placa)` |
| **RN02** | `km_ida_volta > 0` | `CHECK` SQL + parse no formulário |
| **RN03** | Recusa exige motivo não vazio | `validarMotivoRecusa` |
| **RN04** | Viagem projetada ≤ `proxima_manutencao_km − 500` | `MARGEM_KM_PADRAO = 500` |
| **RN05** | Motorista só reserva veículo em operação | `VeiculoDisponibilidadeService` |
| **RN06** | Status reserva: `PENDENTE` → `APROVADO` \| `REJEITADO` → `CONCLUIDA` | enum `status_reserva` |
| **RN07** | Status veículo: `disponivel`, `em_viagem`, `em_manutencao`, `parado` | domínio `StatusVeiculo` |
| **RN08** | Preventiva: alerta se ≤ 5 dias **ou** ≤ 500 km | `PreventiveAlertService` |
| **RN09** | Prioridade: 7 d/500 km MÉDIA; 3 d/200 km ALTA; vencido CRÍTICA | `FleetPriorityAlertService` |
| **RN10** | Atraso de viagem: `APROVADO`, sem `data_fim`, `em_viagem`, agora > `max(2 h, km/50)` | `TripDelayAlertService` |
| **RN11** | SELECT de manutenções RLS: gestor/mecânico/super_admin | `manutencoes_select` |
| **RN12** | Super admin não solicita reserva; motorista não aprova | subclasses `Usuario` |
| **RN13** | Valor da OS = mão de obra + peças | `Manutencao.calcularValorTotal` |
| **RN14** | ESG diesel: 2,68 kg/L e 0,25 L/km | `FATORES_EMISSAO` / `CONSUMO` |
| **RN15** | ESG gasolina: 2,27 kg/L e 0,10 L/km | idem |
| **RN16** | ESG etanol: 1,50 kg/L e 0,125 L/km | idem |
| **RN17** | ESG elétrico: 0 kg/L e 0 L/km | idem |
| **RN18** | Fórmula: `litros = km × L/km`; `kgCO₂ = litros × fator`; `árvores = t × 7` | `calculateTripEmissions` |
| **RN19** | Marcos ESG 50, 100, 500, 1 000, 2 500 kg | `EsgAlertService.MARCOS_KG` |
| **RN20** | Simulador: custo diesel R$ 6,20/L, gasolina R$ 6,50/L, etanol R$ 4,20/L; EV 0,20 kWh/km × R$ 0,90 | `esgTransition.ts` |
| **RN21** | Score = 40% preventiva em dia + 30% preventiva vs corretiva + 30% emissão/km | `esgFleetScore.ts` |
| **RN22** | Score ≥ 80 Excelente; ≥ 50 Atenção; &lt; 50 Crítico | `classifyEsgScore` |
| **RN23** | IA não executa escrita | `isMutationRequest` |
| **RN24** | Auditoria: `viagem_criada`, `veiculo_em_manutencao`, `veiculo_liberado` | `AuditAction` |

**Não há tabela `emissoes` nem `abastecimentos`:** o ESG é **calculado** a partir de `reservas.km_ida_volta` (ou `km_percorrido`) e do combustível inferido/cadastrado.

---

## 5. Modelo de dados (tabelas canônicas)

`empresas`, `usuarios`, `veiculos`, `manutencoes`, `reservas`, `chaves_convite`, `solicitacoes_relatorio`, `audit_logs`. Diagrama ER: `diagramas/05_diagrama_banco_er.png` (rótulos curtos: OS = manutenções, CONVITE = chaves_convite, RELAT = solicitações_relatorio, AUDIT = audit_logs).

## 6. Fora de escopo (código atual)

- React Native, Expo, Express, Prisma.
- Login Google (removido da UI).
- TCO / custo por km (módulo removido).
- Tabela persistida `alertas` (schema canônico não cria; alertas são **derivados** na aplicação).
