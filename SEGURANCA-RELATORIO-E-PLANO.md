# Relatório de Segurança e Boas Práticas — Orbixlead CRM

> **Data:** 11/09/2026
> **Escopo:** Monorepo completo — `apps/api` (Express + Prisma), `apps/web` (Next.js), `apps/scraper` (BullMQ + Playwright), infraestrutura Docker (`docker-compose.yml`, `docker-stack.yml`) e configuração de ambiente.
> **Objetivo:** Avaliar prontidão para **deploy em produção** sob a ótica de segurança e boas práticas.
> **Premissa acordada com o cliente:** O **Redis permanece sem senha**, pois só é acessível pela rede Docker interna. Este relatório **não** trata isso como vulnerabilidade, apenas registra as recomendações de defesa em profundidade (item INFRA-03).

---

> ## ✅ Status de execução — 11/09/2026
> **Fases 0, 1, 2 e 3 implementadas no código.** Todos os itens do plano foram aplicados (ver colunas "Status" na Seção 5). API e Scraper compilam sem erros.
>
> **Pendências apenas de infraestrutura (não são código), a executar no ambiente de produção:**
> - Criar os segredos reais com `docker secret create ...` (ver topo do `docker-stack.yml`).
> - Configurar as variáveis `SMTP_*` reais (Brevo) em produção.
> - (Opcional) Ativar o bloqueio do merge no Trivy (`exit-code: "1"`) após triagem inicial.

---

## 1. Sumário Executivo

O sistema tem uma base sólida: **isolamento multi-tenant consistente** (todas as queries filtram por `tenantId`), **hashing de senha com bcrypt (custo 12)**, **proteção contra enumeração de e-mail** no fluxo de recuperação, **advisory lock** na criação do super admin, **cookies `httpOnly`/`sameSite`** e a web já roda como usuário não-root.

Porém, há **lacunas relevantes para produção**, principalmente:

- **Ausência total de rate limiting** (login, reset de senha, convites) → brute force e abuso.
- **Segredos com fallback inseguro no código** → risco de subir em produção com segredo previsível.
- **Falta de cabeçalhos de segurança** (Helmet na API, CSP/HSTS/X-Frame-Options na Web).
- **Vazamento de mensagens de erro internas (5xx)** para o cliente.
- **Containers da API e do Scraper rodando como root**.
- **Sessão não é regenerada no login** (session fixation) e **não é invalidada ao trocar senha**.

### Painel de severidade

| Severidade | Qtd. | IDs |
| --- | --- | --- |
| 🔴 Crítica | 3 | SEC-01, SEC-02, CONF-01 |
| 🟠 Alta | 6 | SEC-03, SEC-04, SEC-05, INFRA-01, CONF-02, SEC-06 |
| 🟡 Média | 8 | SEC-07, SEC-08, SEC-09, SEC-10, INFRA-02, INFRA-03, OBS-01, DATA-01 |
| 🔵 Baixa | 6 | SEC-11, SEC-12, QLTY-01, QLTY-02, OBS-02, INFRA-04 |

---

## 2. Metodologia e critério de severidade

Revisão manual de código (SAST leve) + análise de configuração de infraestrutura. Sem execução de testes dinâmicos (DAST).

- 🔴 **Crítica** — explorável remotamente com alto impacto (comprometimento de contas/dados) ou risco de exposição de segredo em produção.
- 🟠 **Alta** — impacto significativo; exploração plausível ou pré-condição comum.
- 🟡 **Média** — impacto moderado ou requer condições específicas.
- 🔵 **Baixa** — defesa em profundidade, hardening e higiene de código.

---

## 3. Achados detalhados

### 🔴 SEC-01 — Ausência de rate limiting / proteção contra brute force
**Onde:** `apps/api/src/routes/auth.ts` (login, forgot-password, reset-password, accept-invite), `apps/api/src/index.ts` (sem middleware global).
**Descrição:** Não há nenhum limite de tentativas em nenhum endpoint. O `/login` aceita tentativas ilimitadas, permitindo **brute force / credential stuffing**. O `/forgot-password` e o `/invite` permitem **e-mail bombing** (disparo ilimitado de e-mails). O `/reset-password` e `/accept-invite` permitem força bruta de tokens (embora tokens de 32 bytes tornem isso impraticável, o custo de CPU/DB é real).
**Impacto:** Comprometimento de contas por força bruta; abuso do provedor SMTP (Brevo) com possível bloqueio/custo; DoS por CPU (bcrypt é caro por design).
**Recomendação:** Adicionar `express-rate-limit` (com store no Redis já existente, via `rate-limit-redis`) — limite global + limites mais estritos em `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/collaborators/invite`. Considerar bloqueio temporário de conta após N falhas.

---

### 🔴 SEC-02 — Segredos com fallback inseguro embutido no código
**Onde:**
- `apps/api/src/index.ts` → `secret: process.env.SESSION_SECRET || "dev-orbixlead-session-secret-change-me"`
- `docker-compose.yml` → Postgres `orbixlead:orbixlead`; `INTERNAL_API_KEY: orbixlead-internal-dev-key`

**Descrição:** Se `SESSION_SECRET` não for definido, a aplicação **sobe silenciosamente** com um segredo público e previsível. Quem conhecer o valor (está no repositório) consegue **forjar/assinar cookies de sessão**. O mesmo padrão vale para o `INTERNAL_API_KEY` de desenvolvimento.
**Impacto:** Falsificação de sessão → sequestro de qualquer conta. É o pior cenário se houver um erro de configuração no deploy.
**Recomendação:** Em produção, **falhar o boot** (`process.exit(1)`) se `SESSION_SECRET` estiver ausente ou tiver menos de 32 chars, ou for igual ao default. O mesmo para `INTERNAL_API_KEY`. Nunca usar fallback em `NODE_ENV=production`.

---

### 🔴 CONF-01 — Placeholders de produção precisam ser garantidamente substituídos
**Onde:** `docker-stack.yml` → `DATABASE_URL=...ALTERE_A_SENHA...`, `SESSION_SECRET: altere-para-um-segredo...`, `INTERNAL_API_KEY: altere-esta-chave-interna`.
**Descrição:** A stack de produção contém placeholders literais. Se qualquer um subir sem troca, o sistema fica trivialmente comprometido (agrava o SEC-02).
**Impacto:** Comprometimento total se implantado como está.
**Recomendação:** Migrar segredos para **Docker Secrets** (ou cofre) e nunca versioná-los no `docker-stack.yml`. Enquanto isso, a mitigação do SEC-02 (falhar boot com segredo default/placeholder) elimina o risco de subir com placeholder.

---

### 🟠 SEC-03 — Vazamento de detalhes internos em erros 5xx
**Onde:** `apps/api/src/index.ts` (error handler):
```ts
const message = err instanceof Error ? err.message : "Erro interno";
return res.status(status || 500).json({ error: message });
```
**Descrição:** Para erros 500, a mensagem real da exceção (que pode conter detalhes do Prisma, SQL, caminhos, etc.) é devolvida ao cliente.
**Impacto:** Divulgação de informação que facilita ataques (ex.: estrutura de tabelas, versões).
**Recomendação:** Em 5xx, logar o detalhe internamente (já é feito) e responder ao cliente com mensagem genérica (`"Erro interno"`) + um `requestId` para correlação.

---

### 🟠 SEC-04 — Sem cabeçalhos de segurança na API (Helmet)
**Onde:** `apps/api/src/index.ts` — nenhum `helmet()`.
**Descrição:** Faltam headers como `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, etc.
**Impacto:** Exposição a clickjacking, sniffing de MIME e vazamento de referrer.
**Recomendação:** `app.use(helmet())` na API. HSTS já pode vir do Traefik, mas configure de forma explícita.

---

### 🟠 SEC-05 — Sem cabeçalhos de segurança na Web (CSP/HSTS/X-Frame-Options)
**Onde:** `apps/web/next.config.ts` — não há `async headers()`.
**Descrição:** A aplicação Next.js não emite CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` nem `Permissions-Policy`.
**Impacto:** Sem CSP, o impacto de um eventual XSS é maximizado; sem `X-Frame-Options`, clickjacking.
**Recomendação:** Adicionar `headers()` no `next.config.ts` com CSP (idealmente com nonce), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva.

---

### 🟠 SEC-06 — Session fixation: sessão não é regenerada no login
**Onde:** `apps/api/src/routes/auth.ts` — `/login`, `/setup`, `/accept-invite`, `/reset-password` apenas fazem `req.session.userId = user.id` sem `req.session.regenerate()`.
**Descrição:** O ID de sessão anterior é mantido após autenticação. Um atacante que fixe um SID na vítima pode reutilizá-lo após o login (session fixation).
**Impacto:** Sequestro de sessão em cenários de fixation.
**Recomendação:** Chamar `req.session.regenerate()` antes de gravar `userId` no login/aceite de convite/setup.

---

### 🟠 INFRA-01 — Containers da API e do Scraper rodam como root
**Onde:** `apps/api/Dockerfile` e `apps/scraper/Dockerfile` — sem diretiva `USER` (a Web já usa `nextjs`).
**Descrição:** Ambos executam como `root` dentro do container. O scraper usa a imagem base do Playwright (root) executando um navegador — superfície de ataque maior.
**Impacto:** Escalada de privilégio em caso de RCE dentro do container; violação do princípio de menor privilégio.
**Recomendação:** Criar usuário não-root e `USER` nos dois Dockerfiles. No scraper, rodar o Chromium como usuário `pwuser` (já existe na imagem do Playwright).

---

### 🟠 CONF-02 — Seed destrutivo com credenciais fixas não deve alcançar produção
**Onde:** `apps/api/prisma/seed.ts` — `deleteMany()` em massa + senhas default (`Orbixlead@Admin123` etc.).
**Descrição:** O seed **apaga e recria** dados e cria usuários com senhas conhecidas (documentadas em `INICIALIZACAO-DEV.md`). Se executado por engano em produção, causa perda de dados e contas com senha pública.
**Impacto:** Perda de dados / contas triviais de invadir.
**Recomendação:** Guardar o seed atrás de um check explícito (ex.: abortar se `NODE_ENV=production` sem uma flag `ALLOW_SEED=1`). Em produção, usar `SUPER_ADMIN_*` (bootstrap) ou a tela `/setup`, não o seed. O `docker-entrypoint.sh` já roda apenas `migrate deploy` (correto — não roda seed).

---

### 🟡 SEC-07 — CSV injection (formula injection) na exportação de leads
**Onde:** `apps/api/src/routes/leads.ts` → `csvEscape()`:
```ts
function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
```
**Descrição:** Campos como `companyName` vêm de scraping/entrada do usuário e vão para o CSV sem neutralizar os prefixos de fórmula (`=`, `+`, `-`, `@`, tab, CR). Ao abrir no Excel/Sheets, uma célula iniciada por `=` pode executar fórmula.
**Impacto:** Execução de fórmula/exfiltração no cliente que abrir o CSV.
**Recomendação:** Prefixar com apóstrofo (`'`) ou espaço campos que iniciem com `= + - @ \t \r`, além do escape de aspas atual.

---

### 🟡 SEC-08 — Sessão não é invalidada ao trocar/redefinir a senha
**Onde:** `apps/api/src/routes/auth.ts` (`/reset-password`), `apps/api/src/routes/settings.ts` (`/password`).
**Descrição:** Ao redefinir ou alterar a senha, as **demais sessões ativas continuam válidas** (o store de sessão em `Session` não é limpo para aquele usuário).
**Impacto:** Após um vazamento de senha e reset, o atacante com sessão ativa continua logado.
**Recomendação:** Ao trocar a senha, apagar todas as sessões do usuário (ex.: `DELETE FROM "Session"` cujo `data` contenha o `userId`, ou manter índice `userId` na tabela de sessão) exceto a atual.

---

### 🟡 SEC-09 — Comparação não constante do INTERNAL_API_KEY
**Onde:** `apps/api/src/routes/internal.ts` → `key !== expected`.
**Descrição:** Comparação de string comum permite, em teoria, timing attack sobre a chave interna. Além disso, o log `internal_unauthorized` registra `headerLen`/`expectedLen` (comprimento do segredo).
**Impacto:** Baixo na prática (rede interna), mas é hardening recomendado; e o log expõe o tamanho do segredo.
**Recomendação:** Usar `crypto.timingSafeEqual` (com verificação de tamanho antes) e remover `expectedLen`/`headerLen` dos logs.

---

### 🟡 SEC-10 — Ausência de proteção CSRF explícita
**Onde:** `apps/api/src/index.ts` — autenticação por cookie com `sameSite: "lax"`.
**Descrição:** A defesa hoje depende apenas de `SameSite=Lax` + validação de origem do CORS. `Lax` cobre a maioria dos casos, mas não requisições `POST` disparadas por navegação de topo em cenários específicos.
**Impacto:** Risco residual de CSRF em ações state-changing.
**Recomendação:** Avaliar `sameSite: "strict"` para o cookie de sessão (a app é single-origin atrás do Traefik) e/ou adotar token anti-CSRF (double-submit) para rotas mutáveis.

---

### 🟡 INFRA-02 — Portas do Postgres/Redis publicadas no host (compose de dev)
**Onde:** `docker-compose.yml` → `ports: 5432:5432` e `6379:6379`.
**Descrição:** No compose, banco e Redis ficam expostos em `0.0.0.0` do host. Aceitável em dev, mas perigoso se esse arquivo for reaproveitado num servidor.
**Impacto:** Exposição de banco/fila à rede do host.
**Recomendação:** Em produção usar apenas rede interna (o `docker-stack.yml` já faz isso — Postgres/Redis externos, sem publicar portas). Se precisar publicar em dev, restringir a `127.0.0.1:5432:5432`.

---

### 🟡 INFRA-03 — Redis sem senha (defesa em profundidade) — *aceito pelo cliente*
**Onde:** `docker-compose.yml` / `docker-stack.yml` → `REDIS_URL: redis://redis:6379`.
**Descrição:** Conforme acordado, o Redis fica **sem senha** por só ser acessível via rede Docker. **Não é tratado como vulnerabilidade.** Registrado apenas para rastreabilidade.
**Recomendação (opcional, não obrigatória):** Garantir que o serviço Redis **nunca** publique a porta 6379 externamente e que a rede overlay `network_public` não permita acesso indevido de outros serviços não confiáveis. Nenhuma ação de senha é necessária.

---

### 🟡 OBS-01 — Tokens sensíveis e PII em logs
**Onde:** `apps/api/src/lib/mailer.ts` (`email_skipped_no_smtp` loga o **texto completo**, incluindo links de reset/convite), `apps/api/src/routes/internal.ts` (loga payloads), `auditLog.meta` guarda `phoneE164`.
**Descrição:** Sem SMTP configurado, **links de redefinição de senha e convite vão para o log**. Em produção, qualquer pessoa com acesso a logs consegue redefinir senhas.
**Impacto:** Escalonamento via acesso a logs; exposição de PII (telefones).
**Recomendação:** **Garantir SMTP configurado em produção** (o comportamento de logar link só deve existir em dev). Reduzir verbosidade dos logs internos e evitar logar conteúdo de e-mail/PII fora de dev.

---

### 🟡 DATA-01 — Política de senha fraca (mínimo 8, sem verificação)
**Onde:** validações `z.string().min(8)` em `auth.ts`, `admin.ts`, `settings.ts`.
**Descrição:** Apenas comprimento mínimo de 8; sem checagem de complexidade nem contra listas de senhas vazadas.
**Impacto:** Senhas fracas facilitam brute force (combinado com SEC-01).
**Recomendação:** Elevar mínimo para 10–12, e/ou usar `zxcvbn` ou verificação HIBP (k-anonymity). No mínimo, exigir tamanho maior.

---

### 🔵 SEC-11 — Timing enumeration residual no forgot-password
**Onde:** `apps/api/src/routes/auth.ts` (`/forgot-password`).
**Descrição:** A resposta é sempre `ok` (bom), mas o caminho quando o usuário existe faz criação de token + envio de e-mail, gerando diferença de tempo observável.
**Impacto:** Enumeração de contas por timing (baixo).
**Recomendação:** Uniformizar tempo de resposta (ex.: processar de forma assíncrona / adicionar jitter). Prioridade baixa.

---

### 🔵 SEC-12 — Limite de payload apenas no JSON global
**Onde:** `apps/api/src/index.ts` → `express.json({ limit: "2mb" })`.
**Descrição:** 2mb é razoável, mas endpoints como `/internal/jobs/:id/complete` aceitam arrays grandes de resultados sem limite de itens explícito.
**Impacto:** Possível pressão de memória/DB com payloads grandes (mitigado pela chave interna).
**Recomendação:** Definir `.max()` no array de `results` e demais arrays via Zod.

---

### 🔵 QLTY-01 — Dependências sem varredura de vulnerabilidades / pinning por range
**Onde:** `package.json` de todos os apps (uso de `^`), sem `pnpm audit` no fluxo.
**Descrição:** Não há automação de auditoria de dependências.
**Recomendação:** Adicionar `pnpm audit` ao CI e habilitar Dependabot/Renovate. Fixar versões críticas.

---

### 🔵 QLTY-02 — Ausência de CI/CD com gates de segurança
**Onde:** repositório (não há workflows).
**Descrição:** Sem pipeline com lint/typecheck/audit/testes antes do build da imagem.
**Recomendação:** Criar workflow (GitHub Actions) com `typecheck`, `lint`, `pnpm audit`, build e scan de imagem (Trivy).

---

### 🔵 OBS-02 — Sem healthcheck/observabilidade além do `/health`
**Onde:** API — `/health` simples; sem métricas/tracing.
**Recomendação:** Adicionar readiness (checa DB/Redis) e, se possível, métricas/tracing. Prioridade baixa.

---

### 🔵 INFRA-04 — Imagem base do scraper pode ficar defasada
**Onde:** `apps/scraper/Dockerfile` → `mcr.microsoft.com/playwright:v1.51.0-noble` fixa.
**Descrição:** Boa prática fixar a tag, mas exige processo de atualização para receber patches de segurança do SO/navegador.
**Recomendação:** Processo periódico de bump + rebuild; scan de imagem no CI.

---

## 4. Pontos positivos observados

- ✅ **Isolamento multi-tenant** aplicado consistentemente (`tenantId` em todas as queries de leads/capturas/settings).
- ✅ **bcrypt** com custo 12 para hashing de senha.
- ✅ **Anti-enumeração** no `/forgot-password` (resposta sempre `ok`).
- ✅ **Advisory lock** (`pg_advisory_xact_lock`) evita corrida na criação do super admin.
- ✅ Cookies `httpOnly`, `sameSite: lax`, `secure` automático em produção; `trust proxy` correto para Traefik.
- ✅ **Web roda como usuário não-root** (`nextjs`).
- ✅ `.env` corretamente ignorado no Git (`.gitignore`) e **não versionado**.
- ✅ Validação de entrada com **Zod** em praticamente todas as rotas.
- ✅ Tokens de reset/convite com 32 bytes aleatórios (`crypto.randomBytes(32)`), com expiração e uso único.

---

## 5. Plano de Ação para Deploy em Produção

Organizado por fases. **Fase 0 é bloqueante** — não subir para produção sem concluí-la.

### 🔴 Fase 0 — Bloqueadores de produção (fazer antes do go-live) — ✅ CONCLUÍDA (11/09/2026)

| # | Item | Ação concreta | Esforço | Status |
| --- | --- | --- | --- | --- |
| 0.1 | SEC-02 / CONF-01 | Fazer o boot da API **falhar** se `SESSION_SECRET` ou `INTERNAL_API_KEY` estiverem ausentes, curtos (<32 chars) ou iguais ao default/placeholder, quando `NODE_ENV=production`. | S | ✅ `apps/api/src/lib/env.ts` + `assertProductionSecrets()` no `index.ts` |
| 0.2 | CONF-01 | Gerar segredos fortes reais (`openssl rand -hex 32`) e substituir todos os placeholders (`ALTERE_A_SENHA`, `altere-*`) na stack; migrar para **Docker Secrets**. | M | ✅ `docker-stack.yml` com `secrets:` + padrão `*_FILE` (`apps/api/src/lib/secrets-file.ts`, scraper idem) |
| 0.3 | SEC-01 | Adicionar `express-rate-limit` (store no Redis) — global + limites estritos em `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/collaborators/invite`. | M | ✅ `apps/api/src/middleware/rate-limit.ts` (store Redis) |
| 0.4 | OBS-01 | Configurar **SMTP (Brevo) em produção** e garantir que links de reset/convite **não** sejam logados fora de dev. | S | ✅ `apps/api/src/lib/mailer.ts` (não loga link em prod; alerta se SMTP ausente) |
| 0.5 | CONF-02 | Proteger o seed contra execução em produção (abortar se `NODE_ENV=production` sem `ALLOW_SEED=1`); confirmar que só `migrate deploy` roda no `docker-entrypoint.sh`. | S | ✅ guarda em `apps/api/prisma/seed.ts` |
| 0.6 | SEC-03 | Ajustar o error handler para responder mensagem genérica em 5xx (mantendo log interno + `requestId`). | S | ✅ error handler no `index.ts` (mensagem genérica + `requestId`) |

> **Nota operacional (0.2/0.4):** o **código** está pronto para Docker Secrets e SMTP. Falta a **ação de infraestrutura** no deploy: criar os `docker secret create ...` (ver topo do `docker-stack.yml`) e definir as variáveis `SMTP_*` reais no ambiente de produção.

### 🟠 Fase 1 — Hardening essencial — ✅ CONCLUÍDA (11/09/2026)

| # | Item | Ação concreta | Esforço | Status |
| --- | --- | --- | --- | --- |
| 1.1 | SEC-04 | `app.use(helmet())` na API. | S | ✅ `index.ts` (CSP desabilitada na API; é papel da Web) |
| 1.2 | SEC-05 | `headers()` no `next.config.ts`: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. | M | ✅ `apps/web/next.config.ts` |
| 1.3 | SEC-06 | `req.session.regenerate()` no login/setup/accept-invite antes de gravar `userId`. | S | ✅ helper `establishSession()` em `auth.ts` |
| 1.4 | INFRA-01 | Adicionar usuário não-root + `USER` nos Dockerfiles da API e do Scraper. | M | ✅ `USER node` (api) / `USER pwuser` (scraper) |
| 1.5 | SEC-08 | Invalidar demais sessões do usuário ao trocar/redefinir senha. | M | ✅ `destroyUserSessions()` em `session-store.ts`, usado em `auth.ts` e `settings.ts` |

### 🟡 Fase 2 — Robustez e defesa em profundidade — ✅ CONCLUÍDA (11/09/2026)

| # | Item | Ação concreta | Esforço | Status |
| --- | --- | --- | --- | --- |
| 2.1 | SEC-07 | Neutralizar prefixos de fórmula (`= + - @ \t \r`) no `csvEscape`. | S | ✅ `leads.ts` (`csvEscape` + `phoneE164` escapado) |
| 2.2 | SEC-09 | Usar `crypto.timingSafeEqual` no `INTERNAL_API_KEY` e remover `headerLen`/`expectedLen` dos logs. | S | ✅ `internal.ts` (`timingSafeEquals`) |
| 2.3 | SEC-10 | Avaliar `sameSite: "strict"` e/ou token anti-CSRF em rotas mutáveis. | M | ✅ `sameSite: strict` em produção (`index.ts`) |
| 2.4 | DATA-01 | Elevar política de senha (mín. 10–12) e/ou integrar verificação HIBP/zxcvbn. | M | ✅ `lib/validators.ts` (mín. 10 + letra e número), aplicado em auth/settings/admin/bootstrap |
| 2.5 | SEC-12 | Adicionar `.max()` nos arrays de entrada (ex.: `results` em `/internal/.../complete`). | S | ✅ internal/captures/leads |
| 2.6 | INFRA-02 | Garantir que dev não publique 5432/6379 em `0.0.0.0` (usar `127.0.0.1:`); confirmar stack de prod sem portas publicadas. | S | ✅ `docker-compose.yml` (bind `127.0.0.1`) |

### 🔵 Fase 3 — Processo, observabilidade e manutenção — ✅ CONCLUÍDA (11/09/2026)

| # | Item | Ação concreta | Esforço | Status |
| --- | --- | --- | --- | --- |
| 3.1 | QLTY-02 | Pipeline CI: `typecheck`, `lint`, `pnpm audit`, build e scan de imagem (Trivy). | M | ✅ `.github/workflows/ci.yml` |
| 3.2 | QLTY-01 | Habilitar Dependabot/Renovate; rodar `pnpm audit` regularmente. | S | ✅ `.github/dependabot.yml` + `pnpm audit` no CI |
| 3.3 | OBS-02 | Endpoint de readiness (checa DB/Redis) + métricas/tracing básicos. | M | ✅ `GET /ready` (checa DB e Redis) |
| 3.4 | OBS-01 | Revisar verbosidade de logs internos; evitar PII fora de dev. | S | ✅ log por-request interno só em dev |
| 3.5 | INFRA-04 | Processo de atualização periódica da imagem do Playwright + rebuild. | S | ✅ coberto pelo Dependabot (`package-ecosystem: docker`) |
| 3.6 | SEC-11 | Uniformizar tempo de resposta do `/forgot-password` (jitter). | S | ✅ jitter em `auth.ts` |

> **Esforço:** S = baixo (até ~2h), M = médio (~meio dia a 1 dia).

> **Métricas/tracing:** o readiness (`/ready`) foi entregue. Instrumentação de métricas/tracing (Prometheus/OpenTelemetry) fica como melhoria futura opcional (não bloqueante).

---

## 6. Checklist rápido de go-live (resumo da Fase 0)

- [x] API falha o boot com segredo ausente/fraco/default em produção. *(código pronto)*
- [x] Suporte a Docker Secrets (`*_FILE`) na API e no scraper; stack sem segredos em texto puro.
- [ ] **Infra:** criar os `docker secret create ...` reais antes do deploy.
- [x] Rate limiting ativo em login e endpoints sensíveis.
- [x] Código não loga links de reset/convite em produção. — [ ] **Infra:** configurar `SMTP_*` reais.
- [x] Seed impossível de rodar acidentalmente em produção.
- [x] Erros 5xx não vazam detalhes internos.

---

*Relatório gerado por análise estática de código e configuração. Recomenda-se, após aplicar a Fase 0/1, um teste de intrusão (DAST) para validação dinâmica.*
