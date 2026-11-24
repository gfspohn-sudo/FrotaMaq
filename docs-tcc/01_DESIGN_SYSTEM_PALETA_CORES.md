# Design System e Paleta de Cores — FrotaMaq

**Fonte de verdade:** `src/index.css` (`@theme` Tailwind 4), `src/components/FrotaMaqLogo.tsx`, `public/logo-frotamaq.svg`, `src/components/ui/*`.  
Não há `tailwind.config.js` clássico: os tokens vivem em `@theme` do CSS.

---

## 1. Identidade visual e logo

O mark oficial é um quadrado arredondado (`rx = 16` em viewBox 64×64) com:

- fundo em degradê **ardósia** `#1e293b` → `#0f172a`;
- silhueta de caminhão/maquinário em **azul** `#93c5fd` → `#2563eb`;
- folha **esmeralda** `#34d399` → `#059669` (ESG);
- nós conectados em **ciano/sky** `#38bdf8`, `#67e8f9`, `#34d399` (IA).

Arquivos:

| Artefato | Caminho |
|---|---|
| SVG público / favicon | `public/logo-frotamaq.svg` |
| Favicon legado (mesmo mark) | `public/favicon.svg` |
| Componente React | `src/components/FrotaMaqLogo.tsx` |
| Uso | Sidebar (36 px + wordmark “ESG · IA”), TopBar mobile (32 px), Login (64 px) |

Wordmark: **FrotaMaq**, Inter semibold, cor `text-fg`. Subtítulo opcional em `text-action` uppercase tracking largo.

Título da aba: `FrotaMaq — Gestão Inteligente de Frotas & ESG` (`index.html`).

---

## 2. Paleta oficial (HEX extraídos do código)

### 2.1 Tokens Tailwind (`@theme` em `src/index.css`)

| Token | HEX | Uso semântico |
|---|---|---|
| `--color-action` | **`#2563eb`** | Ação primária, links, FAB, foco |
| `--color-success` | **`#059669`** | Sucesso, preventiva em dia, ESG “bom” |
| `--color-warning` | **`#d97706`** | Atenção, OS em andamento, score médio |
| `--color-danger` | **`#e11d48`** | Erro, recusa, alerta crítico |
| `--color-inactive` | **`#64748b`** | Status parado / inativo |
| `--color-navy-900` | **`#0f172a`** | Ardósia profunda (texto claro / fundo logo) |
| `--color-navy-800` | **`#1e293b`** | Ardósia (logo, surface dark) |

### 2.2 Superfícies — tema claro (`:root`)

| Token CSS | HEX | Tailwind |
|---|---|---|
| `--fm-canvas` | `#f8fafc` | `bg-canvas` |
| `--fm-surface` | `#ffffff` | `bg-surface` |
| `--fm-surface-muted` | `#f1f5f9` | `bg-surface-muted` |
| `--fm-border` | `rgb(226 232 240 / 0.8)` ≈ `#e2e8f0` | `border-border` |
| `--fm-fg` | `#0f172a` | `text-fg` |
| `--fm-fg-muted` | `#475569` | `text-fg-muted` |
| `--fm-fg-subtle` | `#94a3b8` | `text-fg-subtle` |

### 2.3 Superfícies — tema escuro (`.dark`)

| Token | HEX |
|---|---|
| `--fm-canvas` | `#020617` |
| `--fm-surface` | `#0f172a` |
| `--fm-surface-muted` | `#1e293b` |
| `--fm-border` | `#1e293b` |
| `--fm-fg` | `#f8fafc` |
| `--fm-fg-muted` | `#94a3b8` |
| `--fm-fg-subtle` | `#64748b` |

### 2.4 ESG, IA e logo (utilitárias Tailwind usadas nos componentes)

| Papel | HEX | Onde |
|---|---|---|
| Esmeralda ESG | **`#10b981`** (`emerald-500`) | Barras de pegada, anel de score “excelente” |
| Esmeralda escuro | **`#059669`** (`emerald-600` / `--color-success`) | Folha do logo, botões de progresso ESG |
| Esmeralda claro | **`#34d399`** (`emerald-400`) | Folha clara do logo, ROI Verde |
| Ciano IA | **`#06b6d4`** (`cyan-500`) | Referência semântica de IA |
| Sky / circuito IA | **`#38bdf8`** (`sky-400`) | Borda do logo e nós do Co-Piloto |
| Sky ligação | **`#67e8f9`** (`cyan-300`) | Traços neurais do mark |
| Azul máquina | **`#2563eb`** (`blue-600` / `--color-action`) | Caminhão do logo e CTA |
| Azul claro | **`#93c5fd`** (`blue-300`) | Degradê da cabine |
| Azul cabine | **`#1d4ed8`** (`blue-700`) | Recorte frontal do caminhão |
| Âmbar score | **`#f59e0b`** (`amber-500`) | “Atenção — Oportunidade de Otimização” |
| Rose score | **`#f43f5e`** (`rose-500`) | “Crítico — Alto Passivo” (próximo de `--color-danger`) |

---

## 3. Tipografia

- Família: **Inter** (`--font-sans`), carregada no `index.html` (400/500/600/700).
- Corpo: `text-sm` / `text-base`, `antialiased`.
- Títulos de página: `text-xl sm:text-2xl font-semibold tracking-tight`.
- KPIs ESG: `text-3xl font-bold`.
- Labels uppercase: `text-xs font-semibold tracking-wide` (ESG) ou `tracking-[0.14em]` (logo).
- Tabular nums no score: `tabular-nums`.

---

## 4. Espaçamento, raios, sombras e movimento

| Padrão | Implementação |
|---|---|
| Seção de página | `.page-section` → `space-y-6 px-4 py-6 lg:px-8` |
| Card | `rounded-xl border border-border bg-surface p-4 shadow-sm` |
| Botão | `rounded-lg` + `active:scale-[0.98]` |
| Logo | `rx=16` no SVG (canto ~25%) |
| Inputs | `rounded-lg`, anel `focus:ring-2 focus:ring-action/20` |
| Overlay | `backdrop-blur-xl`, `bg-surface/80` (`.glass-panel`) |
| Hover card | `-translate-y-0.5` + `shadow-md` |
| Sidebar | `w-64`, `border-r border-border` |
| Bottom nav | `h-16`, `lg:hidden` |
| Animações | fade 180 ms, scale 200 ms, slide 220 ms; `pulse-alert` 2,4 s |

---

## 5. Componentes UI padrão (`src/components/ui/`)

| Componente | Papel |
|---|---|
| `Button` | `primary` `#2563eb`, `secondary` borda, `danger` `#e11d48`, `ghost` |
| `Card` | Superfície elevada; `interactive` para navegação |
| `Input` / `Select` / `Textarea` | Formulários com label |
| `Modal` / `Drawer` | Overlay `bg-slate-900/50` |
| `Toast` | Feedback de exportação, reserva, erro |
| `KpiCard` | Dashboard (tons success/action/warning/inactive/danger) |
| `EmptyState` | Listas vazias com ícone + ação opcional |
| `Skeleton` / `Spinner` | Loading |
| `StatusBadge` / `PlateBadge` | Status de veículo/OS e placa |
| `DataTable` | Relatórios e resumo por empresa |

---

## 6. Aplicação semântica por módulo

- **Operação / navegação:** azul `#2563eb` + ardósia `#0f172a`.
- **ESG / simulador ROI Verde:** esmeralda `#10b981` / `#059669` sobre fundo `from-slate-900 to-emerald-950`.
- **IA:** ciano/sky `#38bdf8` + nós `#34d399`.
- **Risco:** `#d97706` (atenção) e `#e11d48` (crítico / recusa).

Este conjunto deve ser reutilizado em slides, PDF da monografia e prototipação — sem introduzir roxo/laranja fora dos tokens acima.
