# Decisões de especificação — Orbixlead CRM (MVP)

Versão: 1.0 · Data: 2026-09-10  
Status: **fechado para implementação** (substitui lacunas abertas do PRD 1.0)

Este documento consolida as respostas do workshop de gaps. Em conflito com o PRD ou Design System, **este arquivo prevalece** até nova revisão explícita.

---

## A. Stack e arquitetura

| # | Decisão | Escolha |
|---|---|---|
| 1 | Backend HTTP | **Express** |
| 2 | Frontend | **Next.js App Router** — API Routes apenas como BFF quando necessário; domínio na API Node |
| 3 | Scraper | **Playwright** |
| 4 | Auth | **Cookie session httpOnly** + **bcrypt** |
| 5 | ORM | **Prisma** (`prisma/schema.prisma` = fonte da verdade do ER) |
| 6 | E-mail | **SMTP via Brevo** (Sendinblue) |
| 7 | Estrutura de repo | **Monorepo**: `apps/web`, `apps/api`, `apps/scraper` |
| 8 | Deploy inicial | **Docker Compose** local → VPS depois; Swarm não no dia 1 |

### Implicações

- Três apps no mesmo repositório; scraper pode rodar em host/VPS diferente consumindo a mesma fila Redis.
- Sessão server-side (store em Redis ou tabela `sessions`); sem JWT no MVP.
- Brevo: configurar SMTP (host/user/pass) via env; templates de e-mail mínimos (convite, reset, alertas).

---

## B. Multi-tenant, papéis e auth

| # | Decisão | Escolha |
|---|---|---|
| 9 | Criação de conta | **Somente super admin cria tenant** (sem self-signup) |
| 10 | Convite colaborador | **E-mail com link** → usuário define senha |
| 11 | Super admin | **Painel web mínimo**: tenants, créditos/pacotes, modo livre |
| 12 | Operador | **Só Captura + CRM** (sem Dashboard, Metas, Mensagens, Colaboradores, Créditos) |
| 13 | Reset senha | **E-mail com token** |

### Papéis

| Papel | Escopo |
|---|---|
| `super_admin` | Plataforma: criar tenant, liberar pacotes, modo livre, visão global |
| `admin` | Tenant: Dashboard, Captura, CRM, Mensagens, Metas, Colaboradores, Créditos (consulta), Configurações |
| `operador` | Tenant: Captura, CRM |

Permissões devem ser enforced no **backend**, não só na UI.

---

## C. Créditos e pacotes

| # | Decisão | Escolha |
|---|---|---|
| 14 | Ciclo | **Mensal, não acumula** — ao renovar/liberar novo ciclo, saldo anterior não usado não carrega |
| 15 | Modo livre | Flag **`unlimited: true`** (créditos `null` / ignorados) |
| 16 | Débito | **Reserva ao iniciar a busca** (`quantidade pedida`) + **ajuste no fim** (devolve duplicados/falhos/sem telefone) |
| 17 | UI saldo | **`restante / teto`** do ciclo atual |
| 18 | Histórico | Tabela **`credit_ledger`** desde o MVP |

### Pacotes comerciais (liberação manual pelo super admin)

- 500 / 1.500 / 5.000 leads por ciclo mensal
- Liberação registra no ledger (`grant`); consumo registra (`reserve`, `settle`, `release`)

### Fluxo de reserva (16)

1. Usuário pede N leads (N ≤ min(restante, 100)).
2. Sistema **reserva** N no saldo disponível.
3. Job roda; ao finalizar: debita efetivo = leads **novos e válidos**; libera a diferença da reserva.
4. Se job falha após retry: libera reserva restante; registra falha no ledger/logs.

---

## D. Captura, scoring e dedupe

| # | Decisão | Escolha |
|---|---|---|
| 19 | Países MVP | **Somente Brasil** |
| 20 | Qtd máxima / job | **min(créditos restantes, 100)**; modo livre → cap 100 |
| 21 | Sem telefone | **Descarta** — não salva, não consome crédito |
| 22 | Telefone | Normalizar **E.164** (`+55…`) |
| 23 | Dedupe nome | **Exact match normalizado** (lower, trim, remove sufixos tipo LTDA/ME/EIRELI) |
| 24 | Scoring | Matriz abaixo (aceita) |
| 25 | UX progresso | **Polling** a cada 2–3s |
| 26 | Falha / retry | **1 retry automático**, depois `failed`; **logs na API** (sem entrega parcial obrigatória) |

### Chave de dedupe

`tenant_id` + `phone_e164` + `company_name_normalized`

### Comportamento de duplicado na captura (30)

- **Não reapresentar** como lead novo consumível.
- Marcar / indicar **“já na base”** (na UX do job ou omitir da lista de novos — preferência: omitir da contagem de novos e expor contador “já existentes: X”).
- **Não debita** crédito.
- Não é obrigatório atualizar o lead existente neste MVP (diferente da sugestão B+C anterior).

### Matriz de temperatura (24)

| Sinal | Forte | Fraco |
|---|---|---|
| Avaliações | ≥ 50 reviews **ou** (nota ≥ 4.5 **e** ≥ 20 reviews) | &lt; 10 reviews |
| Site | tem website | sem website |
| Social | ≥ 1 rede | nenhuma |

Regras:

1. Site + social + avaliações fortes → **Frio**
2. Sem site + avaliações fracas → **Quente**
3. Sem site + (avaliações fortes **ou** social) → **Morno**
4. Fallback → **Morno**

### Jobs (26)

- Status: `queued` → `running` → `completed` | `failed`
- Em falha transitória: **1 retry**; se falhar de novo → `failed`, liberar reserva, **log estruturado na API**
- Sem garantia de resultado parcial neste MVP

### Anti-ban inicial (44)

- 1 browser, delays “humanos”, **1 job por vez** na fila do scraper

---

## E. CRM, pipeline, leads

| # | Decisão | Escolha |
|---|---|---|
| 27 | Pipeline default | `Novos → Abordados → Agendados → Follow up → Convertidos → Perdidos` |
| 28 | Customização | **Label editável** + **`slug` fixo** para métricas |
| 29 | Entrada no Kanban | **Somente após “Enviar para CRM”** |
| 30 | Duplicado na captura | Ver seção D |
| 31 | Excluir na captura | Soft delete **só do resultado do job**; **não afeta** lead já no CRM |
| 32 | Detalhe do lead | **Drawer rápido + página** `/crm/leads/:id` |
| 33 | Agenda | **Tela Agenda na nav + aba no lead** |

### Slugs fixos do pipeline default

| Label default | Slug |
|---|---|
| Novos | `new` |
| Abordados | `contacted` |
| Agendados | `scheduled` |
| Follow up | `follow_up` |
| Convertidos | `converted` |
| Perdidos | `lost` |

Usuário pode renomear labels; dashboard só agrega por slug conhecido.

### Fluxo captura → CRM

1. Scraping grava resultados do job (staging).
2. Usuário seleciona e **Enviar para CRM** → cria/vincula `Lead` no estágio `new`.
3. Captura sem envio **não** aparece no Kanban.

---

## F. Dashboard, metas, mensagens

| # | Décisão | Escolha |
|---|---|---|
| 34 | Funil dashboard | **Todos os estágios ativos do tenant** (mesma ordem/posição do CRM; arquivados não entram) |
| 34b | Destaque visual do card | Marcadores pré-definidos no lead (`none`, `urgent`, `closing`, `waiting`, `missing`, `follow_up`) alteram a cor do card no Kanban |
| 35 | Custo por conversão | Campo manual nas configs: **custo médio do lead** (R$) |
| 36 | Conversão por categoria | Por **segmentação da busca** (nicho) |
| 37 | Metas | **Várias metas paralelas**; a **mesma meta mensal pode ser decomposta em semanal e diária** |
| 38 | Lucro | Fórmula padrão abaixo |
| 39 | Templates | **CRUD completo**; variáveis `{nome}` `{empresa}` |
| 40 | WhatsApp | Abre **nova aba** `wa.me` com texto encoded |

### Fórmula de meta (38)

- `faturamento = preco_venda × conversoes_alvo`
- `custo_total = custo_por_conversao × conversoes_alvo`
- `lucro = faturamento − custo_total`
- `% lucro = lucro / faturamento` (se faturamento &gt; 0)

`custo_por_conversao` pode vir do campo de config (35) ou override na própria meta.

### Modelo de metas (37) — interpretação

- Tenant pode ter **várias metas** ativas em paralelo (ex.: nichos ou campanhas diferentes).
- Uma meta **mensal** pode ter **filhas** (ou breakdown) **semanal** e **diária** que somam/distribuem o alvo do mês.
- Progresso: diário ⊆ semanal ⊆ mensal (mesma árvore / `parent_meta_id`).

Detalhe de schema a fechar na implementação Prisma:

- `Goal` com `period_type`: `monthly | weekly | daily`
- `parent_id` opcional (weekly/daily ligados ao monthly)
- Validação: soma dos alvos filhos não precisa ser rígida no MVP, mas UI deve deixar claro o vínculo

### KPI custo por conversão (dashboard)

`(leads_importados_periodo × custo_medio_lead_config) / convertidos_periodo`  
(ou zero/“—” se convertidos = 0)

---

## G. Dados, API, LGPD, infra

| # | Decisão | Escolha |
|---|---|---|
| 41 | ER | **Prisma schema** no repo |
| 42 | API | **REST** `/api/v1` |
| 43 | Scraper | **Fila Redis (BullMQ)**; worker só na VPS/host do scraper |
| 44 | Anti-ban | Ver seção D |
| 45 | LGPD | **Termos B2B** + **export CSV** dos leads do tenant + **soft-delete manual** pelo admin + log |
| 46 | Notificações in-app | Como Design System (lista, lida/não lida): captura concluída, créditos baixos, convite aceito |

### Fora de escopo (reafirmado)

- Checkout / gateway
- WhatsApp API / automação
- i18n
- Portal público de descadastro LGPD
- Self-signup
- Proxy residencial desde o dia 1
- Resultado parcial de scraping

---

## H. Ordem de entrega (fatias)

| Fatia | Conteúdo |
|---|---|
| **1** | Monorepo + Compose + Auth (session) + Super admin cria tenant + Admin/Operador + seed |
| **2** | CRM Kanban + detalhe lead + Agenda + templates + `wa.me` (leads manuais/seed) |
| **3** | Captura com **job mock** (sem Google) + créditos (reserva/settle) + ledger + UI captura |
| **4** | Scraper Playwright real (1 job por vez) + polling + logs API |
| **5** | Dashboard + Metas (mensal/semanal/diária) + notificações in-app + export CSV |

Seed rico (48) desde a fatia 1–2 para demo de UI.

---

## Entidades mínimas (orientação Prisma)

- `Tenant` — flags `unlimited`, ciclo de créditos, `credit_cap`, `credit_remaining`, `cycle_ends_at`
- `User` — `role`: super_admin | admin | operador; `tenantId` nullable para super_admin
- `Session`
- `CreditLedger` — tipo: grant | reserve | settle | release | adjust
- `ScrapingJob` — status, params, counts, logs ref
- `ScrapingResult` — staging por job; soft delete
- `Lead` — CRM; FK estágio; telefone E.164; temperatura; cardMarker (destaque visual)
- `PipelineStage` — label + slug + position + tenantId + archivedAt (opcional)
- `MessageTemplate`
- `Schedule`
- `Goal` — period_type, parent_id, pricing fields
- `Notification`
- `Invite` / `PasswordResetToken`
- Config tenant: `avg_lead_cost` (custo médio)

---

## Checklist rápido pós-decisão

- [x] Stack fechada (Express, Next App Router, Playwright, Prisma, Brevo SMTP, monorepo, Compose)
- [x] Auth e papéis fechados
- [x] Créditos: mensal sem acúmulo, reserva, ledger, UI restante/teto
- [x] Captura BR, scoring, dedupe, retry×1 + logs
- [x] Pipeline default + slugs + enviar para CRM
- [x] Metas paralelas com breakdown mensal→semanal→diária
- [x] LGPD mínimo A+B+C
- [x] Roadmap em 5 fatias

**Próximo passo sugerido:** gerar `prisma/schema.prisma` inicial + esqueleto do monorepo (`apps/web`, `apps/api`, `apps/scraper`) conforme fatia 1.
