# Orbixlead CRM

SaaS multi-tenant de **captura de leads** (Google Maps), **qualificação** (frio / morno / quente), **CRM Kanban**, **WhatsApp via `wa.me`**, **metas** e **créditos**.

> Documentação de produto e design em [`system/`](./system/). Em conflito de regras, prevalece [`system/DECISOES-MVP.md`](./system/DECISOES-MVP.md). Em UI, prevalece o [Design System](./system/Design%20System%20—%20Orbixlead%20CRM.md).

---

## Sumário

- [Stack](#stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Pré-requisitos](#pré-requisitos)
- [Setup local](#setup-local)
- [Credenciais do seed](#credenciais-do-seed)
- [Scripts](#scripts)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Arquitetura](#arquitetura)
- [Módulos principais](#módulos-principais)
- [Docker](#docker)
- [Fontes de verdade](#fontes-de-verdade)

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Web | Next.js 15 (App Router) + React 19 + Mantine 7 + Lucide |
| API | Express + Prisma + express-session (cookie httpOnly) |
| Banco | PostgreSQL 16 |
| Fila | Redis 7 + BullMQ |
| Scraper | Worker Playwright (`SCRAPER_MODE=playwright`) ou **mock** |
| E-mail | SMTP Brevo (opcional em dev — links no console) |
| Monorepo | pnpm workspaces · Node 22+ |

Cor primária do Design System: `#15AABF`.

---

## Estrutura do repositório

```text
orbixlead/
├── apps/
│   ├── web/          # Interface Next.js + Mantine
│   ├── api/          # API REST /api/v1
│   └── scraper/      # Worker BullMQ (mock | Playwright)
├── packages/
│   └── shared/       # Scoring, telefone E.164, templates, constantes
├── system/           # PRD, Design System, decisões do MVP
├── img/              # Assets de marca
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) **≥ 22**
- [pnpm](https://pnpm.io/) **≥ 11**
- [Docker](https://www.docker.com/) + Docker Compose (Postgres e Redis)

---

## Setup local

```bash
# 1) Ambiente
cp .env.example .env

# 2) Dependências
pnpm install

# 3) Infra
docker compose up -d postgres redis

# 4) Banco (generate + migrate + seed)
pnpm db:setup

# 5) Apps (três terminais)
pnpm dev:api
pnpm dev:web
pnpm dev:scraper
```

| Serviço | URL |
| --- | --- |
| App (web) | http://localhost:3000 |
| API | http://localhost:4000 |
| Health API | http://localhost:4000/health |

A web faz **rewrite** de `/api/*` para a API, mantendo cookie de sessão same-origin em desenvolvimento.

---

## Credenciais do seed

| Papel | E-mail | Senha |
| --- | --- | --- |
| Super admin | `admin@orbixlead.local` | `Orbixlead@Admin123` |
| Admin (tenant demo) | `demo@orbixlead.local` | `Orbixlead@Demo123` |
| Operador | `operador@orbixlead.local` | `Orbixlead@Oper123` |

Tenant demo: **Demo Orbixlead** (créditos de exemplo + pipeline + leads).

---

## Scripts

Na raiz do monorepo:

| Script | Descrição |
| --- | --- |
| `pnpm install` | Instala dependências do workspace |
| `pnpm db:generate` | Gera Prisma Client |
| `pnpm db:migrate` | Aplica migrations |
| `pnpm db:seed` | Popula dados de demonstração |
| `pnpm db:setup` | generate + migrate + seed |
| `pnpm dev:api` | API em watch (`tsx`) |
| `pnpm dev:web` | Next.js em http://localhost:3000 |
| `pnpm dev:scraper` | Worker da fila `scraping` |
| `pnpm build` | Build de todos os packages/apps |

---

## Variáveis de ambiente

Copie [`.env.example`](./.env.example) para `.env`. Principais:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL |
| `REDIS_URL` | Redis (BullMQ + fila) |
| `API_PORT` / `API_URL` | Porta e URL da API |
| `SESSION_SECRET` | Segredo do cookie de sessão |
| `WEB_ORIGIN` | Origin do front (CORS + cookies) |
| `SCRAPER_MODE` | `mock` (padrão) ou `playwright` |
| `INTERNAL_API_KEY` | Chave `x-internal-key` API ↔ scraper |
| `SMTP_*` | Brevo SMTP (vazio = log no console) |
| `SEED_*` | Credenciais usadas no seed |

---

## Arquitetura

```text
┌────────────┐     cookie session      ┌────────────┐
│  apps/web  │ ───────────────────────▶│  apps/api  │
│  Next.js   │     /api/v1/*           │  Express   │
└────────────┘                         └─────┬──────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
               PostgreSQL                  Redis                 Brevo SMTP
                                             │
                                             ▼
                                       apps/scraper
                                    (BullMQ concurrency 1)
```

- **Créditos:** reserva ao iniciar captura → settle / release ao concluir.
- **Dedupe:** `telefone E.164` + nome da empresa (normalizado), por tenant.
- **Entrada no CRM:** somente após **Adicionar ao CRM** (staging de captura).
- **WhatsApp:** abre `wa.me` com template (`{nome}`, `{empresa}`) — sem API oficial no MVP.

---

## Módulos principais

| Área | Rotas / comportamento |
| --- | --- |
| Auth | Login, convite, reset de senha, sessão cookie |
| Super admin | Tenants, pacotes 500 / 1.500 / 5.000, modo livre |
| Captura | Job assíncrono, polling, créditos |
| Leads capturados | Tabela, filtros (Drawer), envio ao CRM |
| Pipeline | Kanban, filtros, novo estágio |
| Mensagens | CRUD de templates WhatsApp |
| Agenda | Retornos agendados |
| Metas | Mensal com breakdown semanal / diário |
| Dashboard | KPIs, funil, prospecção 30 dias, meta |
| Configurações | Tabs: Meu perfil · Colaboradores · Notificações |
| LGPD | Export CSV + soft-delete com auditoria |

### Papéis

| Papel | Acesso |
| --- | --- |
| `super_admin` | Plataforma (tenants / créditos) |
| `admin` | Conta completa do tenant |
| `operador` | Captura, Leads, CRM, Agenda |

---

## Docker

```bash
# Só infra (recomendado no dia a dia)
docker compose up -d postgres redis

# Stack completa (web + api + scraper + infra)
docker compose up --build
```

Serviços definidos em [`docker-compose.yml`](./docker-compose.yml): `postgres`, `redis`, `api`, `web`, `scraper`.

---

## Fontes de verdade

| Domínio | Documento |
| --- | --- |
| UI / Design System | [`system/Design System — Orbixlead CRM.md`](./system/Design%20System%20—%20Orbixlead%20CRM.md) |
| Protótipo visual | [`system/Orbixlead -design-system.html`](./system/Orbixlead%20-design-system.html) |
| Decisões do MVP | [`system/DECISOES-MVP.md`](./system/DECISOES-MVP.md) |
| PRD | [`system/PRD-CRM-Captura-Leads.md`](./system/PRD-CRM-Captura-Leads.md) |

---

## Licença

Uso privado / interno — ajuste conforme a política do repositório.
