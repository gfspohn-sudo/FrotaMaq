# 🚛 FrotaLog — Sistema de Gestão de Frotas Multi-tenant

> **🇧🇷 Português** | 🇺🇸 [English](#-frotalog---fleet-management-system)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Testes-Vitest-6E9F18?logo=vitest&logoColor=white)

**FrotaLog** (também referenciado como **FrotaMaq** no backend) é uma solução web para **controle de veículos**, **agendamento de reservas**, **ordens de manutenção** e **relatórios gerenciais**, com **segurança em camadas** baseada em papéis (RBAC) e **Row Level Security (RLS)** no PostgreSQL/Supabase.

---

## 📋 Índice

- [Sobre o projeto](#-sobre-o-projeto)
- [Stack tecnológica](#-stack-tecnológica)
- [Funcionalidades principais](#-funcionalidades-principais)
- [Arquitetura](#-arquitetura)
- [Como executar localmente](#-como-executar-localmente)
- [Scripts disponíveis](#-scripts-disponíveis)
- [Auditoria de segurança](#-auditoria-de-segurança)
- [Estrutura do repositório](#-estrutura-do-repositório)

---

## 🎯 Sobre o projeto

O FrotaLog foi projetado para empresas que precisam gerenciar frotas de forma **isolada por tenant** (`empresa_id`), garantindo que cada organização visualize e manipule **apenas seus próprios dados**.

A aplicação combina uma interface moderna em React com regras de negócio no domínio, repositórios Supabase e políticas RLS no banco — reduzindo riscos de **vazamento entre empresas**, **IDOR** (Insecure Direct Object Reference), **XSS** e **escalação de privilégios**.

---

## 🛠 Stack tecnológica

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 19, Vite 8, TypeScript, Tailwind CSS 4, React Router 7 |
| **Backend / BaaS** | Supabase (Auth, PostgREST, PostgreSQL) |
| **Segurança** | RLS por `empresa_id`, RBAC por perfil, validação de escopo no domínio |
| **Gráficos** | Recharts |
| **Testes** | Vitest (unit/integration), Playwright (E2E) |
| **Arquitetura** | Clean Architecture (`domain`, `application`, `infrastructure`, `services`) |

---

## ✨ Funcionalidades principais

### 🏢 Gestão multi-tenant
- Isolamento de dados por **empresa/cliente** (`empresa_id`).
- Super Admin com visão consolidada; demais perfis restritos ao tenant vinculado.

### 🔐 Controle de acesso (RBAC)
Perfis suportados:

| Perfil | Descrição resumida |
|--------|-------------------|
| **Super Admin** | Gestão global de empresas e visão corporativa |
| **Gestor / Gerente** | CRUD da frota, aprovação de reservas e relatórios da empresa |
| **Mecânico** | Registro e conclusão de manutenções |
| **Motorista** | Reservas e consultas — **somente veículos em operação** |

### 🚗 Módulo de veículos
- Cadastro com `nome_exibicao`, placa, quilometragem e status (`Em operação`, `Em manutenção`, `Fora de operação`).
- **Motoristas** visualizam e reservam **apenas veículos com status *Em operação***.
- Tentativas de reserva em veículos indisponíveis são **bloqueadas na API e na UI**.

### 🔧 Módulo de manutenções
- Ordens com status (`PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`).
- Histórico com filtros por tipo (Preventiva, Corretiva, Preditiva).
- Conclusão de manutenção atualiza o status do veículo de volta para operação.

### 📊 Relatórios e dashboard
- Resumo da frota (ativos, em manutenção, parados).
- Manutenções vencidas, em andamento e próximas.
- Relatórios financeiros e exportação CSV por veículo.

### 🛡 Auditoria de segurança integrada
- Políticas **RLS** no PostgreSQL.
- Proteções contra **IDOR**, **XSS** e **vazamento de privilégios**.
- Relatório formal disponível em [`docs/security-audit/relatorio-auditoria-seguranca.pdf`](docs/security-audit/relatorio-auditoria-seguranca.pdf).

---

## 🏗 Arquitetura

```
src/
├── domain/          # Entidades, value objects, regras de negócio
├── application/     # Use cases e application services
├── infrastructure/  # Repositórios Supabase, mappers, DI
├── services/        # Facades para a UI
├── pages/           # Rotas e telas
└── components/      # Componentes reutilizáveis

supabase/            # Scripts SQL (schema, migrations, recriação)
tests/               # Vitest + Playwright
docs/security-audit/ # Relatório de auditoria de segurança
```

---

## 🚀 Como executar localmente

### Pré-requisitos

- **Node.js** 20+
- **npm** 10+
- Projeto **Supabase** configurado (Auth + tabelas + RLS)

### 1. Clonar e instalar dependências

```bash
git clone <url-do-repositorio>
cd FrotaLog
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com as credenciais do seu projeto Supabase:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Variáveis necessárias (ver [`.env.example`](.env.example)):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚙️ | Apenas para `npm run seed:users` (nunca no frontend) |

Obtenha os valores em: **Supabase Dashboard → Project Settings → API**.

### 3. Aplicar o schema no Supabase

Execute no SQL Editor do Supabase o script consolidado:

```
supabase/frota_maq_recreate_complete.sql
```

> Para bancos existentes, use também as migrations em `supabase/`.

### 4. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse a URL exibida no terminal (geralmente `http://localhost:5173`).

### 5. (Opcional) Popular usuários de teste

```bash
npm run seed:users
```

---

## 📜 Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção (TypeScript + Vite) |
| `npm run preview` | Preview do build |
| `npm run test` | Testes em modo watch (Vitest) |
| `npm run test:ci` | Testes CI (execução única) |
| `npm run test:e2e` | Testes end-to-end (Playwright) |
| `npm run lint` | Lint (Oxlint) |
| `npm run seed:users` | Seed de usuários via Supabase Admin API |

---

## 🔒 Auditoria de segurança

O projeto inclui documentação formal de auditoria de segurança:

📄 **[`docs/security-audit/relatorio-auditoria-seguranca.pdf`](docs/security-audit/relatorio-auditoria-seguranca.pdf)**

O relatório cobre análise de RLS, isolamento multi-tenant, vetores IDOR/XSS e recomendações de hardening.

---

## 📁 Estrutura do repositório

| Pasta / arquivo | Conteúdo |
|-----------------|----------|
| `src/` | Código-fonte da aplicação |
| `supabase/` | Scripts SQL e migrations |
| `tests/` | Testes automatizados |
| `docs/security-audit/` | Relatório PDF/HTML de segurança |
| `.env.example` | Template de variáveis de ambiente |
| `playwright.config.ts` | Configuração E2E |

---

<p align="center">
  Desenvolvido com ❤️ para gestão inteligente de frotas.
</p>

---

# 🚛 FrotaLog — Fleet Management System

> 🇧🇷 [Português](#-frotalog--sistema-de-gestão-de-frotas-multi-tenant) | **🇺🇸 English**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)

**FrotaLog** (also referred to as **FrotaMaq** in the backend) is a web solution for **vehicle control**, **reservation scheduling**, **maintenance work orders**, and **management reports**, with **layered security** based on role-based access control (RBAC) and **Row Level Security (RLS)** on PostgreSQL/Supabase.

---

## 📋 Table of contents

- [About](#-about)
- [Tech stack](#-tech-stack)
- [Key features](#-key-features)
- [Architecture](#-architecture-1)
- [Running locally](#-running-locally)
- [Available scripts](#-available-scripts)
- [Security audit](#-security-audit)
- [Repository structure](#-repository-structure)

---

## 🎯 About

FrotaLog is built for companies that need to manage fleets with **strict tenant isolation** (`empresa_id`), ensuring each organization can only view and modify **its own data**.

The app combines a modern React UI with domain business rules, Supabase repositories, and database RLS policies — mitigating **cross-tenant leaks**, **IDOR**, **XSS**, and **privilege escalation**.

---

## 🛠 Tech stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite 8, TypeScript, Tailwind CSS 4, React Router 7 |
| **Backend / BaaS** | Supabase (Auth, PostgREST, PostgreSQL) |
| **Security** | RLS by `empresa_id`, RBAC by role, domain-level scope validation |
| **Charts** | Recharts |
| **Testing** | Vitest (unit/integration), Playwright (E2E) |
| **Architecture** | Clean Architecture (`domain`, `application`, `infrastructure`, `services`) |

---

## ✨ Key features

### 🏢 Multi-tenant management
- Data isolation per **company/client** (`empresa_id`).
- Super Admin with consolidated view; other roles restricted to their linked tenant.

### 🔐 Role-based access control (RBAC)
Supported roles:

| Role | Summary |
|------|---------|
| **Super Admin** | Global company management and corporate dashboard |
| **Manager (Gestor/Gerente)** | Fleet CRUD, reservation approval, company reports |
| **Mechanic (Mecânico)** | Maintenance registration and completion |
| **Driver (Motorista)** | Reservations and read-only access — **operational vehicles only** |

### 🚗 Vehicles module
- Registration with display name, plate, mileage, and status (*In operation*, *In maintenance*, *Out of operation*).
- **Drivers** can only view and reserve **vehicles with *In operation* status**.
- Reservation attempts on unavailable vehicles are **blocked at API and UI level**.

### 🔧 Maintenance module
- Work orders with status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- History with filters by type (Preventive, Corrective, Predictive).
- Completing maintenance sets the vehicle status back to operational.

### 📊 Reports & dashboard
- Fleet summary (active, in maintenance, stopped).
- Overdue, in-progress, and upcoming maintenance.
- Financial reports and per-vehicle CSV export.

### 🛡 Built-in security audit
- **RLS** policies on PostgreSQL.
- Protections against **IDOR**, **XSS**, and **privilege leakage**.
- Formal report: [`docs/security-audit/relatorio-auditoria-seguranca.pdf`](docs/security-audit/relatorio-auditoria-seguranca.pdf).

---

## 🏗 Architecture

```
src/
├── domain/          # Entities, value objects, business rules
├── application/     # Use cases and application services
├── infrastructure/  # Supabase repositories, mappers, DI
├── services/        # UI facades
├── pages/           # Routes and screens
└── components/      # Reusable components

supabase/            # SQL scripts (schema, migrations)
tests/               # Vitest + Playwright
docs/security-audit/ # Security audit report
```

---

## 🚀 Running locally

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- Configured **Supabase** project (Auth + tables + RLS)

### 1. Clone and install

```bash
git clone <repository-url>
cd FrotaLog
npm install
```

### 2. Environment variables

Copy the example file and fill in your Supabase credentials:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Required variables (see [`.env.example`](.env.example)):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚙️ | Only for `npm run seed:users` (never expose in frontend) |

Get values from: **Supabase Dashboard → Project Settings → API**.

### 3. Apply database schema

Run in the Supabase SQL Editor:

```
supabase/frota_maq_recreate_complete.sql
```

> For existing databases, also apply migrations in `supabase/`.

### 4. Start development server

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### 5. (Optional) Seed test users

```bash
npm run seed:users
```

---

## 📜 Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Vite) |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run preview` | Preview production build |
| `npm run test` | Tests in watch mode (Vitest) |
| `npm run test:ci` | CI tests (single run) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` | Lint (Oxlint) |
| `npm run seed:users` | Seed users via Supabase Admin API |

---

## 🔒 Security audit

Formal security audit documentation:

📄 **[`docs/security-audit/relatorio-auditoria-seguranca.pdf`](docs/security-audit/relatorio-auditoria-seguranca.pdf)**

The report covers RLS analysis, multi-tenant isolation, IDOR/XSS vectors, and hardening recommendations.

---

## 📁 Repository structure

| Path | Content |
|------|---------|
| `src/` | Application source code |
| `supabase/` | SQL scripts and migrations |
| `tests/` | Automated tests |
| `docs/security-audit/` | PDF/HTML security report |
| `.env.example` | Environment variable template |
| `playwright.config.ts` | E2E configuration |

---

<p align="center">
  Built with ❤️ for smart fleet management.
</p>
