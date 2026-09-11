# @orbixlead/scraper

Worker BullMQ que consome a fila `scraping`, gera leads (mock ou Playwright/Google Maps) e reporta o resultado via endpoints internos da API — **sem Prisma** no scraper.

## Fluxo

1. Consome job `{ jobId }` da fila Redis `scraping` (concurrency **1**)
2. `POST /api/v1/internal/jobs/:id/start` — marca running e recebe `{ city, segment, quantity, ... }`
3. Scrapa (mock | playwright)
4. `POST /api/v1/internal/jobs/:id/complete` com `{ results: [...] }`
5. Em erro: `POST .../fail` com `{ errorMessage, final, attempt }` e re-throw para o BullMQ (retry configurado no producer/API; `final=true` só na última tentativa)

Header obrigatório: `x-internal-key: $INTERNAL_API_KEY`

## Env

| Variável | Exemplo | Descrição |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis da fila |
| `API_URL` | `http://localhost:4000` | Base da API (sem trailing slash) |
| `INTERNAL_API_KEY` | `orbixlead-internal-dev-key` | Mesma chave da API |
| `SCRAPER_MODE` | `mock` \| `playwright` | Fonte dos leads |

Opcional em Compose: `DATABASE_URL` existe no serviço mas **não é usado** por este worker.

## Dev local

Na raiz do monorepo:

```bash
pnpm install
pnpm --filter @orbixlead/shared build
# subir postgres/redis/api (compose ou pnpm dev:api)
pnpm dev:scraper
```

Mock (padrão): gera empresas BR fictícias — alguns sem telefone, alguns com telefone duplicado — e aplica `normalizePhoneE164` + `scoreTemperature` do `@orbixlead/shared`.

## Deploy VPS (scraper isolado)

Objetivo: manter o scraping fora do host principal (anti-ban / isolamento de IP), conectando só em Redis + API remota.

### 1. Requisitos na VPS

- Docker (recomendado) **ou** Node 22 + Chromium deps
- Saída HTTPS para a API e para `google.com/maps` (modo playwright)
- Acesso de rede ao Redis (VPN/firewall) ou Redis dedicado nessa VPS compartilhado com a API

### 2. Variáveis (exemplo `/etc/orbixlead/scraper.env`)

```bash
REDIS_URL=redis://SEU_REDIS:6379
API_URL=https://api.seudominio.com
INTERNAL_API_KEY=troque-por-chave-forte
SCRAPER_MODE=playwright
```

### 3. Docker (recomendado)

A partir da raiz do monorepo:

```bash
docker build -f apps/scraper/Dockerfile -t orbixlead-scraper:latest .
docker run -d --name orbixlead-scraper --restart unless-stopped \
  --env-file /etc/orbixlead/scraper.env \
  orbixlead-scraper:latest
```

A imagem base é `mcr.microsoft.com/playwright` (browsers já instalados). Rode **uma** réplica — o worker já usa `concurrency: 1`.

### 4. Sem Docker

```bash
pnpm install
pnpm --filter @orbixlead/shared build
pnpm --filter @orbixlead/scraper build
cd apps/scraper
npx playwright install chromium   # se não usar a imagem oficial
node dist/index.js
```

Use systemd ou pm2 com restart on failure.

### 5. Checklist operacional

- [ ] API alcançável em `API_URL` a partir da VPS
- [ ] `INTERNAL_API_KEY` idêntica nos dois lados
- [ ] Redis acessível; fila `scraping` compartilhada com a API
- [ ] `SCRAPER_MODE=mock` só em staging; produção `playwright`
- [ ] Monitorar logs JSON (`job.received` / `job.completed` / `job.failed`)
- [ ] Lembrar: DOM do Google Maps muda com frequência — falhas de extração são esperadas e disparam retry BullMQ

### 6. Compose (dev)

O serviço `scraper` no `docker-compose.yml` da raiz sobe com `SCRAPER_MODE=mock` por padrão.
