# Inicialização — modo desenvolvimento

Guia passo a passo para subir o **Orbixlead CRM** em ambiente local de desenvolvimento (Windows, macOS ou Linux).

Documento complementar: [`README.md`](./README.md).

---

## 1. O que você vai subir

| Serviço | Função | Porta padrão |
| --- | --- | --- |
| PostgreSQL | Banco de dados | `5432` |
| Redis | Fila BullMQ | `6379` |
| API (`apps/api`) | Backend Express + Prisma | `4000` |
| Web (`apps/web`) | Next.js + Mantine | `3000` |
| Scraper (`apps/scraper`) | Worker de captura (mock ou Playwright) | — (consome a fila) |

No desenvolvimento o scraper roda em modo **`mock`** por padrão (não acessa o Google Maps).

---

## 2. Pré-requisitos

Instale e confira as versões:

```bash
node -v    # >= 22
pnpm -v    # >= 11
docker -v
docker compose version
```

### Se não tiver pnpm

```bash
npm install -g pnpm@11
```

### Se não tiver Docker

Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e deixe o Docker em execução antes de continuar.

---

## 3. Clonar / abrir o projeto

```bash
cd F:/docker/orbixlead
```

(Ajuste o caminho se o repositório estiver em outra pasta.)

---

## 4. Arquivo de ambiente

```bash
cp .env.example .env
```

No PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

### O que já vem pronto no `.env.example`

- `DATABASE_URL` apontando para `localhost:5432`
- `REDIS_URL` apontando para `localhost:6379`
- `API_PORT=4000`
- `WEB_ORIGIN=http://localhost:3000`
- `SCRAPER_MODE=mock`
- Credenciais de seed (super admin, demo admin, operador)

### Opcional neste momento

| Variável | Quando preencher |
| --- | --- |
| `SMTP_USER` / `SMTP_PASS` | Envio real de e-mail (Brevo). Se vazio, os links de convite/reset aparecem no **log da API**. |
| `SESSION_SECRET` | Troque em qualquer ambiente compartilhado. |
| `SCRAPER_MODE=playwright` | Só quando for testar scraping real (requer Playwright instalado no scraper). |

Para o primeiro boot em dev, **não é obrigatório** configurar SMTP.

---

## 5. Instalar dependências

Na raiz do monorepo:

```bash
pnpm install
```

Isso instala `apps/web`, `apps/api`, `apps/scraper` e `packages/shared`.

Em seguida, compile o package compartilhado (necessário para a API/scraper importarem `@orbixlead/shared`):

```bash
pnpm --filter @orbixlead/shared build
```

---

## 6. Subir Postgres e Redis

```bash
docker compose up -d postgres redis
```

Confira se estão saudáveis:

```bash
docker compose ps
```

Você deve ver `postgres` e `redis` com status **healthy** / **running**.

### Portas ocupadas?

Se `5432` ou `6379` já estiverem em uso, pare o serviço local conflitante ou altere as portas no `docker-compose.yml` e no `.env`.

---

## 7. Banco de dados (Prisma)

Ainda na raiz:

```bash
pnpm db:setup
```

Esse comando executa, em sequência:

1. `prisma generate` — gera o Prisma Client  
2. `prisma migrate` — cria/aplica as tabelas  
3. `prisma seed` — popula tenant demo, usuários, pipeline, leads e templates  

### Seed OK — saída esperada (exemplo)

```text
Seed OK
{
  superAdmin: 'admin@orbixlead.local',
  demoAdmin: 'demo@orbixlead.local',
  demoOperador: 'operador@orbixlead.local',
  tenant: 'Demo Orbixlead',
  ...
}
```

### Rodar passos isolados (se precisar)

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

> **Atenção:** `pnpm db:seed` **apaga e recria** os dados de demo do banco. Use com cuidado se você já tiver dados locais importantes.

---

## 8. Iniciar os três processos de desenvolvimento

Abra **três terminais** na raiz do projeto.

### Terminal 1 — API

```bash
pnpm dev:api
```

Esperado no log:

```text
api_listening  port: 4000
```

Teste rápido:

```bash
curl http://localhost:4000/health
```

Resposta: `{"ok":true}` (ou equivalente).

### Terminal 2 — Web

```bash
pnpm dev:web
```

Esperado:

```text
▲ Next.js ...
- Local: http://localhost:3000
```

### Terminal 3 — Scraper

```bash
pnpm dev:scraper
```

Esperado:

```text
worker.ready  queue: scraping  mode: mock
```

Sem o scraper, as capturas ficam em `queued` e não concluem.

---

## 9. Acessar o sistema

1. Abra http://localhost:3000/login  
2. Entre com uma conta do seed:

| Papel | E-mail | Senha |
| --- | --- | --- |
| Super admin | `admin@orbixlead.local` | `Orbixlead@Admin123` |
| Admin demo | `demo@orbixlead.local` | `Orbixlead@Demo123` |
| Operador | `operador@orbixlead.local` | `Orbixlead@Oper123` |

### O que cada um vê

- **Super admin** → área de tenants / créditos  
- **Admin** → Dashboard, Captura, Leads, Pipeline, Agenda, Mensagens, Metas, Configurações  
- **Operador** → Captura, Leads, Pipeline, Agenda  

---

## 10. Checklist de validação rápida

Depois do login como **demo admin**:

1. [ ] Dashboard carrega KPIs / funil  
2. [ ] **Captura** → cidade + segmento + quantidade → job vai a `completed` (mock)  
3. [ ] **Leads** → resultados aparecem; selecione e **Adicionar ao CRM**  
4. [ ] **Pipeline** → cards no Kanban; arrastar entre estágios  
5. [ ] **Mensagens** → templates com `{nome}` / `{empresa}`  
6. [ ] **Configurações** → tabs Meu perfil · Colaboradores · Notificações  

Se a captura não concluir: confira se o **Terminal 3 (scraper)** está rodando e se o Redis está up.

---

## 11. Fluxo completo (resumo)

```text
1. cp .env.example .env
2. pnpm install
3. pnpm --filter @orbixlead/shared build
4. docker compose up -d postgres redis
5. pnpm db:setup
6. pnpm dev:api
7. pnpm dev:web
8. pnpm dev:scraper
9. Abrir http://localhost:3000  →  demo@orbixlead.local
```

---

## 12. Parar o ambiente

### Apps (terminais)

`Ctrl + C` em cada terminal (`api`, `web`, `scraper`).

### Containers

```bash
docker compose stop postgres redis
```

Para remover também os volumes (apaga o banco):

```bash
docker compose down -v
```

---

## 13. Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| `pnpm install` lento/travado (Windows) | Aguarde; ou `pnpm install --prefer-offline --config.package-import-method=copy` |
| API não conecta no Postgres | `docker compose ps`; `DATABASE_URL` no `.env` |
| Login funciona na API mas não na web | `WEB_ORIGIN=http://localhost:3000`; web em `3000` e rewrite `/api` |
| Captura fica em `queued` | Scraper rodando? Redis up? `REDIS_URL` igual na API e no scraper |
| `Cannot find module @orbixlead/shared` | `pnpm --filter @orbixlead/shared build` |
| Convite / reset sem e-mail | Normal sem SMTP — veja o link no log da API (`email_skipped_no_smtp`) |
| Porta 3000/4000 ocupada | Encerre o processo antigo ou altere a porta no script/env |

---

## 14. Comandos úteis extras

```bash
# Logs dos containers
docker compose logs -f postgres redis

# Resetar só o seed (recria dados demo)
pnpm db:seed

# Build do shared em watch (opcional)
pnpm --filter @orbixlead/shared dev
```

---

## 15. Próximos passos (fora do escopo deste guia)

- Configurar Brevo (`SMTP_*`) para e-mails reais  
- Alternar `SCRAPER_MODE=playwright` e instalar browsers do Playwright no `apps/scraper`  
- Subir a stack completa com `docker compose up --build` (além do modo “só infra + apps locais”)

---

**Documento:** inicialização em desenvolvimento · Orbixlead CRM  
**Atualizado junto ao monorepo** (`apps/web`, `apps/api`, `apps/scraper`).
