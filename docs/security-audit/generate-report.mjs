/**
 * Gera o Relatório de Auditoria de Segurança (HTML + PDF).
 * Uso (na raiz do repositório): node docs/security-audit/generate-report.mjs
 * Requer @playwright/test já instalado no projeto (não instala nada globalmente).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = __dirname
const HTML_PATH = join(OUT_DIR, 'relatorio-auditoria-seguranca.html')
const PDF_PATH = join(OUT_DIR, 'relatorio-auditoria-seguranca.pdf')
const PREVIEW_DIR = join(OUT_DIR, 'preview')

const COLORS = {
  critica: '#B91C1C',
  alta: '#EA580C',
  media: '#D97706',
  baixa: '#2563EB',
  forte: '#059669',
}

const DATE_LABEL = '21 de setembro de 2026'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function chip(sev) {
  const map = {
    crítica: ['critica', 'Crítica'],
    alta: ['alta', 'Alta'],
    média: ['media', 'Média'],
    baixa: ['baixa', 'Baixa'],
    informativa: ['info', 'Informativa'],
  }
  const [cls, label] = map[sev] ?? ['info', sev]
  return `<span class="chip ${cls}">${label}</span>`
}

function donutSvg() {
  const parts = [
    { n: 4, c: COLORS.critica },
    { n: 10, c: COLORS.alta },
    { n: 3, c: COLORS.media },
    { n: 1, c: COLORS.baixa },
  ]
  const total = parts.reduce((a, p) => a + p.n, 0)
  const r = 54
  const c = 2 * Math.PI * r
  let offset = 0
  const circles = parts
    .map(p => {
      const len = (p.n / total) * c
      const el = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${p.c}" stroke-width="18"
        stroke-dasharray="${len.toFixed(3)} ${(c - len).toFixed(3)}"
        stroke-dashoffset="${(-offset).toFixed(3)}"
        transform="rotate(-90 80 80)" />`
      offset += len
      return el
    })
    .join('\n')
  return `<svg viewBox="0 0 160 160" width="220" height="220" aria-label="Achados por severidade">
    ${circles}
    <circle cx="80" cy="80" r="38" fill="#fff" />
    <text x="80" y="76" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">18</text>
    <text x="80" y="94" text-anchor="middle" font-size="11" fill="#64748b">achados</text>
  </svg>`
}

function barsSvg() {
  const bars = [
    { label: 'Isolamento', n: 7, c: COLORS.critica },
    { label: 'Permissão UI', n: 5, c: COLORS.alta },
    { label: 'Chaves', n: 3, c: COLORS.media },
    { label: 'IDOR', n: 2, c: COLORS.baixa },
    { label: 'XSS', n: 1, c: COLORS.forte },
  ]
  const max = 7
  const W = 420
  const H = 200
  const padL = 86
  const padB = 36
  const padT = 10
  const plotH = H - padT - padB
  const gap = 18
  const barW = (W - padL - 16 - gap * (bars.length - 1)) / bars.length
  const items = bars
    .map((b, i) => {
      const h = (b.n / max) * plotH
      const x = padL + i * (barW + gap)
      const y = padT + (plotH - h)
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${b.c}" />
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${b.n}</text>
        <text x="${x + barW / 2}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#475569">${b.label}</text>`
    })
    .join('')
  const grid = [0, 2, 4, 6, 7]
    .map(v => {
      const y = padT + plotH - (v / max) * plotH
      return `<line x1="${padL}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${v}</text>`
    })
    .join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="420" height="200" aria-label="Achados por categoria">${grid}${items}</svg>`
}

const findings = [
  {
    id: 'F-01',
    sev: 'crítica',
    cat: 'Permissão no navegador',
    loc: 'supabase/frota_maq_recreate_complete.sql:212–237\nmigration_signup_empresa.sql:4–24\nschema.sql:213–219\nfix_database.sql:153–171\nAuthContext.tsx:167–185',
    desc: 'O trigger SECURITY DEFINER handle_new_user grava perfil e empresa_id a partir de raw_user_meta_data, sem validar convite. signUp() envia o perfil escolhido pelo cliente. Qualquer pessoa chama supabase.auth.signUp com perfil=super_admin.',
  },
  {
    id: 'F-02',
    sev: 'crítica',
    cat: 'IDOR',
    loc: 'supabase/frota_maq_recreate_complete.sql:303–314',
    desc: 'Política usuarios_update permite UPDATE do próprio registro (id = auth.uid()) sem travar a coluna perfil nem empresa_id. O usuário autentica e faz update({perfil:\'super_admin\'}) ou troca empresa_id — escalação e salto de tenant, depois lê/altera objetos de outro inquilino por ID.',
  },
  {
    id: 'F-03',
    sev: 'crítica',
    cat: 'Isolamento de tenant',
    loc: 'fix_database.sql:230–304\nsrc/lib/supabase.ts:139 e 101',
    desc: 'GRANT ALL em todas as tabelas para anon+authenticated e políticas USING (true) / WITH CHECK (true), inclusive SELECT anônimo. O próprio cliente pede para executar este script se a tabela usuarios falhar.',
  },
  {
    id: 'F-04',
    sev: 'crítica',
    cat: 'Isolamento de tenant',
    loc: 'supabase/schema_reset_complete.sql:244–271',
    desc: 'Políticas dev_* com USING (true) em empresas, usuarios, veiculos, manutencoes e alertas. Qualquer usuário autenticado lê e escreve todos os inquilinos.',
  },
  {
    id: 'F-05',
    sev: 'alta',
    cat: 'Isolamento de tenant',
    loc: 'supabase/schema.sql:269–329',
    desc: 'SELECT de veiculos, manutencoes e alertas usa apenas auth.uid() IS NOT NULL — sem empresa_id. IDOR cross-tenant: GET por UUID devolve o registro de qualquer empresa.',
  },
  {
    id: 'F-06',
    sev: 'alta',
    cat: 'Isolamento de tenant',
    loc: 'supabase/frota_maq_recreate_complete.sql:432–434\nmigration_rbac_invite_keys.sql:49–51',
    desc: 'chaves_convite_public_validate permite SELECT a anon/authenticated com USING (ativa = TRUE), sem filtrar o token. Um cliente anônimo lista todas as chaves ativas, perfil e empresa_id.',
  },
  {
    id: 'F-07',
    sev: 'alta',
    cat: 'Isolamento de tenant',
    loc: 'supabase/migration_signup_empresa.sql:29–32',
    desc: 'empresas_select_signup dá SELECT de todas as empresas ao papel anon (USING true). Catálogo completo de tenants (id, nome, slug, CNPJ) sem autenticação.',
  },
  {
    id: 'F-08',
    sev: 'alta',
    cat: 'Permissão no navegador',
    loc: 'supabase/frota_maq_recreate_complete.sql:333–492',
    desc: 'No schema canônico, INSERT/UPDATE/DELETE de veículos, manutenções, reservas, convites e solicitações só exigem empresa_id do chamador. Motorista (UI somente leitura) cria, altera e apaga qualquer objeto do tenant via API Supabase.',
  },
  {
    id: 'F-09',
    sev: 'alta',
    cat: 'IDOR',
    loc: 'supabase/migration_reservas_veiculos.sql:51–60',
    desc: 'reservas_update autoriza motorista_id = auth.uid() sem restringir colunas. O motorista atualiza status para APROVADO na própria reserva (autoaprovação por ID).',
  },
  {
    id: 'F-10',
    sev: 'alta',
    cat: 'Chaves expostas',
    loc: 'src/lib/supabase.ts:3–8',
    desc: 'URL do projeto e JWT anon reais hardcoded, usados como fallback se VITE_* estiver vazio. Sem validação de startup que rejeite o default. A chave está no git desde o commit inicial. Explorável de imediato se o RLS estiver fraco (F-03 a F-08).',
  },
  {
    id: 'F-11',
    sev: 'alta',
    cat: 'Chaves expostas',
    loc: 'supabase/frota_maq_recreate_complete.sql:8–9 e 553\nsrc/lib/testUsers.ts:3\nscripts/seed-test-users.mjs:18–20',
    desc: 'Super admin admin@frotamaq.com é criado com senha 123456. A senha aparece no SQL, no frontend e no seed. Se o script rodou no projeto hospedado, o login privilegiado é público.',
  },
  {
    id: 'F-12',
    sev: 'alta',
    cat: 'Permissão no navegador',
    loc: 'src/application/use-cases/VeiculoUseCases.ts:38–40\nManutencaoUseCases.ts:15–17\nsrc/services/vehicles.ts:47–56\nsrc/services/maintenance.ts:39–48\nVehiclesPage.tsx:124',
    desc: 'A UI esconde cadastro com canManageVehicles / canCreateMaintenance. CreateVeiculoUseCase e CreateManutencaoUseCase não verificam papel. O gate existe só no navegador; o servidor (RLS canônico) também não exige gestor.',
  },
  {
    id: 'F-13',
    sev: 'alta',
    cat: 'Isolamento de tenant',
    loc: 'supabase/frota_maq_recreate_complete.sql:359–364\nrls_rbac_policies.sql:176–181\nMotorista.ts:10–11',
    desc: 'SELECT de manutencoes (incluindo valor_total) é liberado a qualquer papel do tenant. Motorista tem podeVisualizarRelatorios()=false na UI, mas lê custos de toda a frota via from(\'manutencoes\').',
  },
  {
    id: 'F-14',
    sev: 'alta',
    cat: 'Isolamento de tenant',
    loc: 'supabase/frota_maq_recreate_complete.sql:222–231\nmigration_signup_empresa.sql:17–18\nAuthContext.tsx:169–184',
    desc: 'empresa_id do cadastro vem dos metadados do Auth. Combinado com F-06/F-07 (IDs vazados), o atacante entra em qualquer tenant no signup, sem chave daquela empresa.',
  },
  {
    id: 'F-15',
    sev: 'média',
    cat: 'Permissão no navegador',
    loc: 'supabase/rls_rbac_policies.sql:143–158',
    desc: 'veiculos_update_policy autoriza mecanico a UPDATE de qualquer coluna do veículo da empresa, não só quilometragem. A UI limita edição; o UPDATE direto altera placa, status, empresa_id (desde que o WITH CHECK passe).',
  },
  {
    id: 'F-16',
    sev: 'média',
    cat: 'Chaves expostas',
    loc: 'src/lib/testUsers.ts:3\nsrc/lib/seedTestUsers.ts:22',
    desc: 'TEST_USER_PASSWORD = \'123456\' entra no bundle Vite. Confirma a senha padrão das contas de demonstração para quem inspeciona o JS.',
  },
  {
    id: 'F-17',
    sev: 'média',
    cat: 'Permissão no navegador',
    loc: 'src/services/vehicles.ts:75–125\nVehiclesPage.tsx:124–137',
    desc: 'deleteAllVeiculos e seedTestVeiculos só aplicam TenantScopeService. A UI mostra os botões com canSeedTestData / canManageVehicles. Motorista autenticado chama as funções (ou o cliente Supabase) e apaga/popula a frota do tenant se o RLS canônico estiver ativo.',
  },
  {
    id: 'F-18',
    sev: 'baixa',
    cat: 'XSS / inputs',
    loc: 'src/pages/VehiclesPage.tsx:231–232\nVehicleDetailPage.tsx:254–255',
    desc: 'foto_url do banco vai direto para <img src> sem allowlist http(s). Não há dangerouslySetInnerHTML. Em navegadores modernos javascript: em img raramente executa; risco residual de URL maliciosa/tracking se a coluna existir (schemas antigos) e o UPDATE de veículo estiver aberto.',
  },
]

const strengths = [
  {
    title: 'TenantScopeService força empresa do perfil',
    ev: 'src/domain/services/TenantScopeService.ts:17–36 — não-super_admin ignora empresaId pedido e usa profile.empresa_id.',
  },
  {
    title: 'rls_rbac_policies.sql combina tenant + papel nas 5 tabelas centrais',
    ev: 'supabase/rls_rbac_policies.sql:126–266 — INSERT/UPDATE/DELETE de veículos, manutenções e alertas exigem gestor/gerente (e mecânico onde cabe) e empresa_id.',
  },
  {
    title: 'Relatório individual autorizado no caso de uso',
    ev: 'GetVeiculoReportUseCase.ts:55–64 + VehicleReportAuthorizationService.ts:14–28 — motorista só no escopo de reserva; mecânico só com solicitação aprovada.',
  },
  {
    title: 'Aprovação de reserva e de relatório checada no application',
    ev: 'ReservaUseCases.ts:104–118 e SolicitacaoRelatorioUseCases.ts:89–97 — podeAprovar* + findById com empresaId.',
  },
  {
    title: 'Criação de empresa só para Super Admin no application',
    ev: 'EmpresaApplicationService.ts:64–66 e InviteKeyUseCases.ts:65–67.',
  },
  {
    title: 'Token de convite com entropia criptográfica',
    ev: 'InviteKeyService.ts:10–13 — crypto.randomUUID(), formato Chave_{Perfil}_{16 hex}.',
  },
  {
    title: 'Seed de usuários exige service_role no ambiente',
    ev: 'scripts/seed-test-users.mjs:3–11 — aborta se SUPABASE_SERVICE_ROLE_KEY faltar; service_role não está no frontend.',
  },
  {
    title: 'deleteAll recusa exclusão global sem empresa_id',
    ev: 'SupabaseVeiculoRepository.ts:67–69.',
  },
  {
    title: 'React escapa texto; sem HTML cru nem eval',
    ev: 'Busca em src/** sem dangerouslySetInnerHTML, innerHTML, eval ou new Function. hrefs de notificação são constantes (GetNotificationsUseCase.ts). CSV escapa aspas (VehicleReportExportService.ts:29–35). .env não está no git.',
  },
  {
    title: 'ProtectedRoute e PermissionService existem para UX',
    ev: 'ProtectedRoute.tsx:45–70 e App.tsx:42–48 — rotas /empresas, /relatorios, /manutencoes, /historico e /alertas. Isso não substitui RLS.',
  },
]

const issues = [
  {
    n: 1,
    title: '[Segurança] Escalação de privilégio no cadastro e na atualização de perfil',
    labels: 'security, crítica',
    ids: 'F-01, F-02, F-14',
    problem: `O backend (trigger SECURITY DEFINER \`handle_new_user\` e a política \`usuarios_update\`) confia no cliente para definir \`perfil\` e \`empresa_id\`.

O frontend de cadastro até valida a chave de convite, mas isso roda só no navegador. Qualquer um abre o DevTools e chama:

\`\`\`js
await supabase.auth.signUp({
  email: 'atacante@mail.com',
  password: 'qualquer',
  options: { data: { nome: 'X', perfil: 'super_admin', empresa_id: '<uuid vazado>' } }
})
\`\`\`

O trigger grava \`super_admin\` ignorando RLS. Se o schema canônico estiver aplicado, um usuário já logado também faz \`supabase.from('usuarios').update({ perfil: 'super_admin' }).eq('id', user.id)\`.

Com \`empresa_id\` escolhido (IDs vazam em F-06/F-07), o atacante entra em outro tenant.`,
    evidence: `\`supabase/frota_maq_recreate_complete.sql:212–237\`
\`\`\`sql
meta_perfil := NULLIF(TRIM(NEW.raw_user_meta_data->>'perfil'), '');
...
COALESCE(meta_perfil::public.perfil_usuario, 'motorista'::public.perfil_usuario),
meta_empresa
\`\`\`

\`supabase/frota_maq_recreate_complete.sql:303–314\` — UPDATE com \`id = auth.uid()\` sem restrição de coluna.

\`src/contexts/AuthContext.tsx:167–185\` — \`signUp\` envia \`perfil\` e \`empresa_id\` do cliente.`,
    impact: 'Conta nova vira Super Admin (visão e escrita em todos os tenants) ou salta para empresa alheia. Quebra total do modelo multi-tenant e do RBAC.',
    fix: `- No trigger: ignorar \`perfil\`/\`empresa_id\` dos metadados. Sempre criar como \`motorista\` (ou perfil da chave validada no servidor).
- Validar convite numa RPC \`SECURITY DEFINER\` que recebe só o token, resolve empresa+perfil e insere o usuário.
- Em \`usuarios\`: política de UPDATE que permite só \`nome\`/campos inofensivos; \`perfil\` e \`empresa_id\` só por \`super_admin\` (ou trigger que rejeita mudança dessas colunas se não for service_role).
- Remover \`upsertUsuarioProfile\` que reescreve perfil a partir do cliente.`,
    accept: [
      'signUp com metadata perfil=super_admin resulta em motorista (ou falha), nunca super_admin',
      'usuarios.update({perfil, empresa_id}) pelo próprio usuário é negado pelo RLS',
      'Cadastro sem chave válida não associa empresa_id arbitrário',
      'Teste automatizado cobre os três caminhos (signup, update próprio, metadata)',
    ],
  },
  {
    n: 2,
    title: '[Segurança] Scripts SQL com RLS permissivo (USING true / GRANT ALL a anon)',
    labels: 'security, crítica',
    ids: 'F-03, F-04, F-05',
    problem: `Há três scripts no repositório que, se executados no projeto Supabase, desligam o isolamento de tenant:

1. \`fix_database.sql\` — \`GRANT ALL\` a \`anon\` e \`authenticated\` + políticas \`USING (true)\` e SELECT anônimo em usuarios/veiculos/manutencoes/alertas. O app ainda instrui a rodá-lo (\`src/lib/supabase.ts\`).
2. \`schema_reset_complete.sql\` — políticas \`dev_*\` \`USING (true)\` em todas as tabelas.
3. \`schema.sql\` — SELECT de frota/manutenções/alertas com \`auth.uid() IS NOT NULL\`, sem \`empresa_id\`.

A fronteira real deste produto é o RLS (SPA fala direto com o PostgREST). Qualquer um desses scripts no banco hospedado permite listar e, nos dois primeiros, alterar dados de todos os inquilinos com a anon key pública.`,
    evidence: `\`fix_database.sql:230–277\`
\`\`\`sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
CREATE POLICY "authenticated_all_usuarios"
  ON public.usuarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "anon_select_veiculos"
  ON public.veiculos FOR SELECT TO anon USING (true);
\`\`\`

\`schema_reset_complete.sql:244–247\` — \`dev_empresas_* USING (true)\`.

\`schema.sql:269–273\` — \`USING (auth.uid() IS NOT NULL)\`.`,
    impact: 'Vazamento e adulteração cross-tenant (e, em fix_database, leitura anônima da frota e da tabela de usuários).',
    fix: `- Arquivar ou apagar \`fix_database.sql\` e as políticas \`dev_*\`. Trocar o aviso do cliente por um script único endurecido.
- Manter um único schema canônico com RLS por \`empresa_id\` + papel; CI/documentação apontam só para ele.
- Auditar o projeto Supabase atual (\`pg_policies\`) e dropar leftovers \`dev_*\`, \`anon_select_*\`, \`authenticated_all_*\`.
- SELECT sempre com \`empresa_id = auth_user_empresa_id()\` (exceto super_admin).`,
    accept: [
      'Nenhum script versionado cria política USING (true) nem GRANT ALL a anon',
      'Consulta SQL no projeto hospedado: zero políticas dev_/anon_select_/authenticated_all_',
      'Usuário da empresa A não lê veículo/manutenção/alerta da empresa B por listagem nem por ID',
      'Papel anon não lê usuarios, veiculos, manutencoes, alertas',
    ],
  },
  {
    n: 3,
    title: '[Segurança] Schema canônico sem RBAC nas escritas e IDOR por UUID',
    labels: 'security, alta',
    ids: 'F-08, F-09, F-13',
    problem: `\`frota_maq_recreate_complete.sql\` isola por tenant, mas as políticas de escrita de \`veiculos\`, \`manutencoes\`, \`reservas\`, \`chaves_convite\` e \`solicitacoes_relatorio\` não exigem papel. Qualquer membro do tenant (incluindo motorista) que conheça o UUID — e o SELECT do tenant entrega a lista — cria, altera ou apaga o objeto.

Em \`migration_reservas_veiculos.sql\` o motorista ainda pode \`UPDATE\` a própria reserva e mudar \`status\` para \`APROVADO\`.

O SELECT de \`manutencoes\` devolve \`valor_total\` a todos os papéis, embora a UI esconda relatórios financeiros do motorista.`,
    evidence: `\`frota_maq_recreate_complete.sql:333–338\` (veículos; o mesmo padrão se repete até a linha 492)
\`\`\`sql
CREATE POLICY "veiculos_insert" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );
\`\`\`

\`migration_reservas_veiculos.sql:51–60\` — \`OR motorista_id = auth.uid()\` no UPDATE sem restrição de coluna.`,
    impact: 'Motorista (ou mecânico) destrói a frota, inventa manutenções, autoaprova reserva e lê custos de toda a empresa. A UI “somente leitura” não impede.',
    fix: `- Portar as restrições de papel de \`rls_rbac_policies.sql\` para o schema canônico (gestor/gerente escrevem veículos; gestor/mecânico escrevem manutenções; só gestor aprova reserva/relatório).
- UPDATE de reserva pelo motorista: proibir mudança de \`status\` (coluna ou política).
- SELECT financeiro: view sem \`valor_total\` para motorista, ou política por papel.
- Repositórios: \`findById\`/\`update\`/\`delete\` sempre com \`empresa_id\` (já parcialmente feito).`,
    accept: [
      'Motorista: INSERT/UPDATE/DELETE em veiculos e manutencoes retorna erro RLS',
      'Motorista: UPDATE reservas.set status=APROVADO retorna erro RLS',
      'Motorista: SELECT valor_total de manutenção de veículo sem reserva/aprovação falha ou vem mascarado',
      'Gestor da mesma empresa continua aprovando reserva e CRUD de frota',
    ],
  },
  {
    n: 4,
    title: '[Segurança] Vazamento de chaves de convite e catálogo de empresas para anon',
    labels: 'security, alta',
    ids: 'F-06, F-07',
    problem: `Duas políticas públicas expõem o mecanismo de onboarding:

- \`chaves_convite_public_validate\` — \`FOR SELECT TO anon, authenticated USING (ativa = TRUE)\`. Não filtra pelo token informado. \`from('chaves_convite').select('*')\` devolve todos os tokens ativos, perfil e \`empresa_id\`.
- \`empresas_select_signup\` — \`FOR SELECT TO anon USING (true)\`. Lista id/nome/slug/CNPJ de todas as empresas.

Com a anon key do frontend (F-10), isso é explorável sem login e alimenta a escalação de F-01/F-14.`,
    evidence: `\`frota_maq_recreate_complete.sql:432–434\` e \`migration_rbac_invite_keys.sql:49–51\`
\`\`\`sql
CREATE POLICY "chaves_convite_public_validate" ON public.chaves_convite
  FOR SELECT TO anon, authenticated
  USING (ativa = TRUE);
\`\`\`

\`migration_signup_empresa.sql:29–32\`
\`\`\`sql
CREATE POLICY "empresas_select_signup" ON public.empresas
FOR SELECT TO anon
USING (true);
\`\`\``,
    impact: 'Qualquer visitante obtém convites válidos (entra como motorista/mecânico de qualquer empresa) e o mapa de tenants.',
    fix: `- Trocar a política pública por RPC \`validar_chave_convite(token text)\` com \`SECURITY DEFINER\` que devolve só empresa_id+perfil se o token existir e estiver ativo; não expor a tabela.
- Remover SELECT anon em \`empresas\`. O cadastro não precisa listar empresas se a chave já resolve o tenant.
- GRANT SELECT em \`chaves_convite\` somente a \`authenticated\` com filtro de tenant, nunca a \`anon\` em todas as linhas ativas.`,
    accept: [
      'Cliente anon: from(\'chaves_convite\').select(\'*\') retorna 0 linhas',
      'RPC/validação com token certo devolve empresa+perfil; token errado não vaza outros tokens',
      'Cliente anon: from(\'empresas\').select(\'*\') retorna 0 linhas',
    ],
  },
  {
    n: 5,
    title: '[Segurança] Credenciais padrão e chave anon hardcoded no frontend',
    labels: 'security, alta',
    ids: 'F-10, F-11, F-16',
    problem: `\`src/lib/supabase.ts\` embute a URL \`https://aechddecxuvysrgpbord.supabase.co\` e o JWT anon do projeto. Se \`VITE_SUPABASE_*\` estiver vazio, esse default é usado — padrão \`${'VAR || hardcoded'}\` sem rejeição no startup.

A chave anon é pública por desenho do Supabase **somente se o RLS estiver correto**. Aqui o RLS tem falhas críticas; o default committed no git (desde \`316ee59\`) aponta para o projeto real.

O schema canônico cria \`admin@frotamaq.com\` / \`123456\`. A mesma senha está em \`testUsers.ts\` (bundle), seeds e scripts.`,
    evidence: `\`src/lib/supabase.ts:3–8\`
\`\`\`ts
export const SUPABASE_URL = 'https://aechddecxuvysrgpbord.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || SUPABASE_URL
\`\`\`

\`frota_maq_recreate_complete.sql:8–9, 553\` — \`crypt('123456', gen_salt('bf'))\`.

Histórico: \`git log\` em \`src/lib/supabase.ts\` mostra o valor no commit inicial. Nenhum \`.env\` real está versionado (ponto positivo).`,
    impact: 'Com RLS fraco, a chave do repositório dá acesso direto ao PostgREST do projeto. A senha 123456, se o seed rodou em produção, é backdoor de Super Admin.',
    fix: `- Remover fallbacks hardcoded. Falhar o boot se \`VITE_SUPABASE_URL\` / \`VITE_SUPABASE_ANON_KEY\` faltarem ou forem placeholder.
- Rotacionar a anon key no painel Supabase (o JWT atual está no git para sempre).
- Trocar a senha de \`admin@frotamaq.com\` no projeto hospedado; seeds de demo só em ambiente local, senha forte e não commitada.
- Tirar \`TEST_USER_PASSWORD\` do código que o Vite empacota (\`src/lib\`).`,
    accept: [
      'Build/dev sem VITE_SUPABASE_* aborta e não usa URL/key embutida',
      'grep no src/ não encontra eyJ... anon nem a URL aechddecxuvysrgpbord',
      'Login admin@frotamaq.com / 123456 falha no projeto hospedado',
      'Bundle de produção não contém 123456 como senha de teste',
    ],
  },
  {
    n: 6,
    title: '[Segurança] Operações privilegiadas só escondidas na UI',
    labels: 'security, alta',
    ids: 'F-12, F-15, F-17',
    problem: `O produto trata PermissionService / ProtectedRoute / flags \`canManage*\` como autorização. Não existe API própria: o “servidor” é o RLS. Onde o caso de uso não checa papel **e** o RLS canônico também não checa, o botão oculto não impede a operação.

Caminhos verificados sem checagem de papel no application:
- \`CreateVeiculoUseCase.execute\` / \`createVeiculo\`
- \`CreateManutencaoUseCase.execute\` / \`createManutencao\`
- \`deleteAllVeiculos\` / \`seedTestVeiculos\` (só escopo de tenant)
- \`veiculos_update_policy\` no RLS RBAC permite ao mecânico atualizar qualquer coluna`,
    evidence: `\`src/application/use-cases/VeiculoUseCases.ts:38–40\`
\`\`\`ts
async execute(input: NovoVeiculo) {
  const { data, error } = await this.veiculoRepo.create(input)
  return { data: data?.toDTO() ?? null, error }
}
\`\`\`

\`src/pages/VehiclesPage.tsx:124\` — botão só se \`canManageVehicles\`.

\`rls_rbac_policies.sql:143–150\` — mecanico em UPDATE de veículos sem lista de colunas.`,
    impact: 'Mesmo que o RLS de papel seja corrigido depois, os use-cases continuam aceitando qualquer profile. Defesa em profundidade ausente. Mecânico altera placa/status além do km.',
    fix: `- Espelhar \`usuario.podeGerenciarVeiculos()\` / \`podeRegistrarManutencao()\` / \`podeSeedTestData()\` nos facades e use-cases antes do repositório.
- No RLS, restringir UPDATE do mecânico às colunas de medição (ou trigger que rejeita mudança de placa/empresa_id/status por mecanico).
- Manter ProtectedRoute só como UX.`,
    accept: [
      'createVeiculo/createManutencao com perfil motorista retorna erro de permissão no application (mesmo se RLS estiver aberto)',
      'deleteAllVeiculos / seed com motorista retorna erro de permissão',
      'UPDATE de placa por mecanico é negado pelo RLS',
    ],
  },
  {
    n: 7,
    title: '[Segurança] URL de foto de veículo sem allowlist de protocolo',
    labels: 'security, baixa',
    ids: 'F-18',
    problem: `\`foto_url\` persistido no banco é interpolado em \`<img src={...}>\` sem validar protocolo. Não há lib de sanitização (DOMPurify) no projeto — e quase não é necessária, porque o restante do frontend usa texto React (escapado). Este é o único sink de URL controlada por dado.

Condição: coluna existe nos schemas antigos (\`schema.sql\`, \`schema_reset_complete.sql\`); o schema canônico não a cria. Explorável se o UPDATE de veículo estiver aberto (F-08/F-15).`,
    evidence: `\`src/pages/VehiclesPage.tsx:231–232\` e \`VehicleDetailPage.tsx:254–255\`
\`\`\`tsx
{v.foto_url ? (
  <img src={v.foto_url} alt={v.modelo} className="h-full w-full rounded-lg object-cover" />
) : (
\`\`\``,
    impact: 'Baixo: navegadores modernos não executam javascript: em img. Resto é pixel de tracking ou conteúdo inesperado. Não é XSS clássico com execução de script no origin da app.',
    fix: 'Permitir só `https:` (e opcionalmente paths do Storage do próprio projeto). Recusar `javascript:`, `data:` e protocolos desconhecidos antes de renderizar.',
    accept: [
      'foto_url com javascript:alert(1) não é atribuído ao src (fica placeholder)',
      'https:// de host esperado continua exibindo a imagem',
    ],
  },
]

function issueBlock(issue) {
  const accept = issue.accept.map(a => `- [ ] ${escapeHtml(a)}`).join('\n')
  const body = `## Título
${issue.title}

## Labels sugeridas
\`${issue.labels}\`

## Achados
${issue.ids}

## Descrição do problema e por que é explorável
${issue.problem}

## Evidência
${issue.evidence}

## Impacto
${issue.impact}

## Sugestão de correção
${issue.fix}

## Critérios de aceite
${issue.accept.map(a => `- [ ] ${a}`).join('\n')}
`
  return `<article class="issue" id="issue-${issue.n}">
    <h3>Issue ${issue.n} — ${escapeHtml(issue.title)}</h3>
    <p class="issue-meta">Labels: <strong>${escapeHtml(issue.labels)}</strong> · Achados ${escapeHtml(issue.ids)}</p>
    <p class="hint">Copie o bloco abaixo e cole numa issue do GitHub.</p>
    <pre class="issue-copy">--- ISSUE ${issue.n} ---
${escapeHtml(body)}
--- FIM ISSUE ${issue.n} ---</pre>
  </article>`
}

function findingsTable() {
  const rows = findings
    .map(
      f => `<tr>
        <td>${chip(f.sev)}</td>
        <td class="mono">${escapeHtml(f.loc)}</td>
        <td><strong>${escapeHtml(f.id)}</strong> · ${escapeHtml(f.cat)}<br/>${escapeHtml(f.desc)}</td>
      </tr>`,
    )
    .join('\n')
  return `<table class="findings">
    <thead><tr><th>Severidade</th><th>Arquivo:linha</th><th>Descrição</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Auditoria de Segurança — FrotaLog</title>
  <style>
    :root {
      --navy: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --bg: #f8fafc;
      --critica: #B91C1C;
      --alta: #EA580C;
      --media: #D97706;
      --baixa: #2563EB;
      --forte: #059669;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--navy);
      font-size: 11.5pt;
      line-height: 1.45;
      background: #fff;
    }
    h1 { font-size: 22pt; margin: 0 0 8px; }
    h2 { font-size: 15pt; color: var(--navy); border-bottom: 2px solid var(--navy); padding-bottom: 6px; margin: 28px 0 12px; page-break-after: avoid; }
    h3 { font-size: 12.5pt; margin: 18px 0 8px; page-break-after: avoid; }
    p { margin: 0 0 10px; }
    ul { margin: 0 0 12px; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .cover {
      min-height: 250mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 8mm 2mm 4mm;
      break-after: page;
      page-break-after: always;
    }
    .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 10pt; color: var(--forte); font-weight: 700; }
    .cover h1 { font-size: 28pt; line-height: 1.15; }
    .meta { color: var(--muted); margin-top: 18px; }
    .scope-box {
      margin-top: 28px;
      background: var(--bg);
      border: 1px solid var(--line);
      border-left: 6px solid var(--navy);
      padding: 14px 16px;
      border-radius: 8px;
    }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 18px; }
    .kpi {
      flex: 1 1 90px;
      border-radius: 10px;
      padding: 10px 8px;
      text-align: center;
      color: #fff;
      page-break-inside: avoid;
    }
    .kpi strong { display: block; font-size: 20pt; }
    .kpi span { font-size: 9pt; opacity: .95; }
    .kpi.critica { background: var(--critica); }
    .kpi.alta { background: var(--alta); }
    .kpi.media { background: var(--media); }
    .kpi.baixa { background: var(--baixa); }
    .kpi.forte { background: var(--forte); }
    .charts { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; page-break-inside: avoid; }
    .chart-card {
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 16px;
    }
    .chart-card h3 { margin-top: 0; border: 0; }
    .legend { list-style: none; padding: 0; margin: 8px 0 0; font-size: 10pt; }
    .legend li { display: flex; align-items: center; gap: 8px; }
    .swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 9pt;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
    }
    .chip.critica { background: var(--critica); }
    .chip.alta { background: var(--alta); }
    .chip.media { background: var(--media); }
    .chip.baixa { background: var(--baixa); }
    .chip.info { background: #475569; }
    table.findings { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.findings th {
      background: var(--navy);
      color: #fff;
      text-align: left;
      padding: 7px 8px;
    }
    table.findings td {
      border-bottom: 1px solid var(--line);
      padding: 8px;
      vertical-align: top;
    }
    table.findings tr { page-break-inside: avoid; }
    table.findings td.mono { font-family: Consolas, "Courier New", monospace; font-size: 8.2pt; white-space: pre-line; width: 28%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media print {
      .two-col { grid-template-columns: 1fr; }
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }
    .card.good { border-top: 4px solid var(--forte); }
    .card.bad { border-top: 4px solid var(--critica); }
    .card h3 { margin-top: 0; }
    .ev { font-size: 9.5pt; color: var(--muted); }
    .prio { page-break-inside: avoid; margin-bottom: 12px; }
    .prio-label { font-weight: 800; color: var(--navy); }
    .issue { page-break-before: always; }
    .issue-meta { color: var(--muted); font-size: 10pt; }
    .hint { font-size: 10pt; color: var(--muted); }
    pre.issue-copy {
      white-space: pre-wrap;
      word-break: break-word;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 8.4pt;
      line-height: 1.4;
      font-family: Consolas, "Courier New", monospace;
    }
    .note { font-size: 10pt; color: var(--muted); }
    @media print {
      .cover { min-height: 250mm; }
      table.findings { font-size: 9pt; }
      pre.issue-copy { font-size: 8pt; }
    }
  </style>
</head>
<body>
  <section class="cover">
    <p class="eyebrow">Auditoria de segurança · SPA + Supabase</p>
    <h1>Relatório de Auditoria de Segurança — FrotaLog</h1>
    <p class="meta"><strong>Data:</strong> ${DATE_LABEL}<br/>
    <strong>Projeto:</strong> FrotaLog (package.json name: frotalog)<br/>
    <strong>Escopo:</strong> repositório completo em C:\\Users\\gabri\\Documents\\FrotaLog — código TypeScript/React, políticas SQL, seeds, CI e histórico git. Sem Docker, Helm ou Terraform no repositório.</p>
    <div class="scope-box">
      <strong>Nota metodológica — mapeamento das cinco categorias à stack</strong>
      <ul>
        <li><strong>Linguagem / frontend:</strong> TypeScript, React 19, Vite 8, Tailwind 4, React Router 7.</li>
        <li><strong>Backend:</strong> não há API própria. O cliente chama o PostgREST/Auth do Supabase. A fronteira de segurança é o <em>Row Level Security</em> do Postgres, com defesa em profundidade em <code>TenantScopeService</code> e use-cases (código de navegador, contornável).</li>
        <li><strong>1. Banco sem tranca</strong> → RLS ausente, <code>USING (true)</code>, SELECT só com <code>auth.uid() IS NOT NULL</code>, ou listagens sem <code>empresa_id</code>.</li>
        <li><strong>2. Permissão no navegador</strong> → gates <code>canManage*</code> / <code>ProtectedRoute</code> / classes <code>Motorista</code> cruzados com políticas RLS e com os use-cases.</li>
        <li><strong>3. IDOR</strong> → todo handler de repositório que recebe id (path da SPA ou <code>.eq('id')</code>) e as políticas UPDATE/DELETE correspondentes. Não há routers HTTP para percorrer; o inventário é o conjunto de repositórios Supabase.</li>
        <li><strong>4. Chaves expostas</strong> → hardcoded, fallbacks <code>env || default</code>, seeds, CI, histórico git e bundle frontend. Sem charts/compose.</li>
        <li><strong>5. XSS</strong> → sinks React (<code>dangerouslySetInnerHTML</code>, <code>eval</code>, URLs em <code>href</code>/<code>src</code>) e HTML de e-mail/templates no backend (inexistente).</li>
      </ul>
      <p class="note" style="margin:0">Achados apenas com evidência no código. A instância Supabase hospedada não foi consultada: a explorabilidade de F-03/F-04/F-05 depende de qual script SQL foi aplicado no projeto.</p>
    </div>
  </section>

  <h2>1. Resumo executivo</h2>
  <p>Foram confirmados <strong>18 achados</strong> no código: 4 críticos, 10 altos, 3 médios e 1 baixo. O risco central é a combinação de <strong>chave anon pública no frontend</strong> com <strong>RLS incompleto ou permissivo</strong> e <strong>escalação de perfil no signup</strong>.</p>
  <div class="kpis">
    <div class="kpi critica"><strong>4</strong><span>Crítica</span></div>
    <div class="kpi alta"><strong>10</strong><span>Alta</span></div>
    <div class="kpi media"><strong>3</strong><span>Média</span></div>
    <div class="kpi baixa"><strong>1</strong><span>Baixa</span></div>
    <div class="kpi forte"><strong>10</strong><span>Pontos fortes</span></div>
  </div>
  <div class="charts">
    <div class="chart-card">
      <h3>Por severidade</h3>
      ${donutSvg()}
      <ul class="legend">
        <li><span class="swatch" style="background:#B91C1C"></span> Crítica (4)</li>
        <li><span class="swatch" style="background:#EA580C"></span> Alta (10)</li>
        <li><span class="swatch" style="background:#D97706"></span> Média (3)</li>
        <li><span class="swatch" style="background:#2563EB"></span> Baixa (1)</li>
      </ul>
    </div>
    <div class="chart-card">
      <h3>Por categoria</h3>
      ${barsSvg()}
    </div>
  </div>

  <h2>2. Pontos fortes e pontos fracos</h2>
  <div class="two-col">
    <div class="card good">
      <h3>O que está protegido</h3>
      ${strengths.map(s => `<p><strong>${escapeHtml(s.title)}.</strong> <span class="ev">${escapeHtml(s.ev)}</span></p>`).join('')}
    </div>
    <div class="card bad">
      <h3>Riscos centrais</h3>
      <p><strong>A fronteira é o RLS, e ela fura em vários scripts.</strong> O app é uma SPA com a anon key no bundle. Se <code>fix_database.sql</code> ou as políticas <code>dev_*</code> estiverem no banco, qualquer autenticado (e em parte o anon) lê e escreve todos os tenants.</p>
      <p><strong>O papel mora no navegador.</strong> Motorista é “somente leitura” nas classes de domínio e na UI, mas o schema canônico autoriza escrita por <code>empresa_id</code> apenas, e o trigger de signup aceita <code>super_admin</code> nos metadados.</p>
      <p><strong>Onboarding público vaza segredos de adesão.</strong> SELECT de todas as chaves ativas + catálogo de empresas para <code>anon</code> torna trivial entrar em qualquer empresa ou alimentar a escalação de perfil.</p>
      <p><strong>Senha e projeto reais no git.</strong> <code>admin@frotamaq.com</code> / <code>123456</code> e o JWT anon do projeto <code>aechddecxuvysrgpbord</code> estão versionados.</p>
    </div>
  </div>

  <h2>3. Achados detalhados</h2>
  <p class="note">Uma linha por achado. A coluna do meio traz caminho e linhas exatas (vários arquivos quando o mesmo defeito se repete).</p>
  ${findingsTable()}

  <h2>4. Recomendações priorizadas</h2>
  <div class="prio"><span class="prio-label">P1 — Fechar escalação de perfil (F-01, F-02, F-14).</span> Reescrever <code>handle_new_user</code> para não ler papel/tenant dos metadados; travar UPDATE de <code>perfil</code> e <code>empresa_id</code>; cadastro só via RPC de convite.</div>
  <div class="prio"><span class="prio-label">P1 — Único schema RLS endurecido (F-03, F-04, F-05, F-08, F-09, F-13).</span> Auditar <code>pg_policies</code> no projeto hospedado; remover leftovers permissivos; unificar recreate + rls_rbac (tenant <em>e</em> papel); proibir autoaprovação de reserva.</div>
  <div class="prio"><span class="prio-label">P1 — Convites e empresas (F-06, F-07).</span> RPC de validação por token; zero SELECT anon em <code>chaves_convite</code> e <code>empresas</code>.</div>
  <div class="prio"><span class="prio-label">P2 — Segredos (F-10, F-11, F-16).</span> Remover fallbacks; falhar o boot; rotacionar anon key; trocar senha do admin; tirar <code>123456</code> do bundle.</div>
  <div class="prio"><span class="prio-label">P2 — Autorização nos use-cases (F-12, F-15, F-17).</span> Checar papel antes do repositório; restringir colunas do UPDATE do mecânico.</div>
  <div class="prio"><span class="prio-label">P3 — foto_url (F-18).</span> Allowlist <code>https:</code> no renderizador de imagem.</div>

  <h2>5. Cobertura da auditoria (o que foi verificado e está correto)</h2>
  <ul>
    <li>Repositórios: <code>SupabaseVeiculoRepository</code>, <code>SupabaseManutencaoRepository</code>, <code>SupabaseReservaRepository</code>, <code>SupabaseSolicitacaoRelatorioRepository</code>, <code>SupabaseChaveConviteRepository</code>, <code>SupabaseEmpresaRepository</code>, <code>SupabaseAlertaRepository</code> (stub — tabela <code>alertas</code> ausente no schema canônico).</li>
    <li>Use-cases de reserva, relatório, convite e empresa <em>checam</em> permissão no application (ponto forte). Veículo create/update/delete e manutenção create <em>não</em> checam (F-12).</li>
    <li>Não há Docker, Helm, Terraform nem <code>docker-compose</code>. CI (<code>.github/workflows/ci.yml</code>) não injeta segredos.</li>
    <li><code>.env</code> real não está no git; <code>.env.example</code> só tem placeholders. <code>SUPABASE_SERVICE_ROLE_KEY</code> não aparece no frontend.</li>
    <li>XSS: nenhum <code>dangerouslySetInnerHTML</code>, <code>innerHTML</code>, <code>eval</code>, <code>new Function</code> ou HTML de e-mail. Sem DOMPurify — e não há renderização de markdown/HTML além de <code>foto_url</code>.</li>
    <li>Categoria “API própria sem filtro de tenant” não se aplica como Express/Fastify; o equivalente auditado foi RLS + queries <code>supabase.from()</code>.</li>
  </ul>

  <h2>6. ISSUES PARA O GITHUB</h2>
  <p>Cada bloco abaixo está delimitado por <code>--- ISSUE n ---</code> e <code>--- FIM ISSUE n ---</code>, pronto para colar.</p>
  ${issues.map(issueBlock).join('\n')}
</body>
</html>
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(HTML_PATH, html, 'utf8')
console.log('HTML escrito em', HTML_PATH)

mkdirSync(PREVIEW_DIR, { recursive: true })

async function launchBrowser() {
  const attempts = [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true },
  ]
  let lastError
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'networkidle' })

await page.pdf({
  path: PDF_PATH,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8px; width:100%; padding: 0 18mm; color:#64748b; font-family:Segoe UI,Arial,sans-serif;">
    Relatório de Auditoria de Segurança — FrotaLog
  </div>`,
  footerTemplate: `<div style="font-size:8px; width:100%; padding: 0 18mm; color:#64748b; font-family:Segoe UI,Arial,sans-serif; display:flex; justify-content:space-between;">
    <span>Confidencial · auditoria estática do repositório</span>
    <span>Página <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`,
  margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
})
console.log('PDF escrito em', PDF_PATH)

const printPage = await browser.newPage({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 1,
})
await printPage.emulateMedia({ media: 'print' })
await printPage.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'networkidle' })
const totalHeight = await printPage.evaluate(() => document.body.scrollHeight)
const pageH = 1123
const pagesToShot = [0, 1, 2, 3, 5, Math.max(0, Math.floor(totalHeight / pageH) - 1)]
for (const i of pagesToShot) {
  await printPage.evaluate(y => window.scrollTo(0, y), i * pageH)
  await printPage.waitForTimeout(100)
  await printPage.screenshot({ path: join(PREVIEW_DIR, `a4-p${i + 1}.png`) })
}
console.log('A4 clips gerados. HTML height:', totalHeight)

const pdfViewer = await browser.newPage({ viewport: { width: 980, height: 1400 } })
await pdfViewer.goto(pathToFileURL(PDF_PATH).href, { waitUntil: 'networkidle' })
await pdfViewer.waitForTimeout(1000)
await pdfViewer.screenshot({ path: join(PREVIEW_DIR, 'pdf-page1.png'), fullPage: false })

await browser.close()
console.log('Previews em', PREVIEW_DIR)
