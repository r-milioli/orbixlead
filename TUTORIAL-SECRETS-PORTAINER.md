# Tutorial — Criar Secrets do Orbixlead no Portainer

Guia passo a passo para criar os **Docker Secrets** usados pela stack `docker-stack.yml` e fazer o deploy pelo **Portainer** (modo Swarm).

> **Pré-requisito:** o Portainer precisa estar conectado a um ambiente **Docker Swarm**.  
> Secrets do Docker **só existem no Swarm** (não no Compose “standalone”).

---

## 1. O que você vai criar

| Nome do secret (exato) | Obrigatório? | O que colocar dentro |
| --- | --- | --- |
| `orbixlead_database_url` | **Sim** | URL completa do Postgres |
| `orbixlead_session_secret` | **Sim** | Texto aleatório (≥ 32 caracteres) |
| `orbixlead_internal_api_key` | **Sim** | Texto aleatório (≥ 16 caracteres; use ≥ 32) |
| `orbixlead_smtp_pass` | Não | Senha SMTP (Brevo) |
| `orbixlead_super_admin_password` | Não | Senha do super admin (se for criar via env) |

**Redis:** continua **sem senha** (`REDIS_URL=redis://redis:6379` na stack). Não precisa de secret para Redis.

Os nomes precisam ser **idênticos** aos do `docker-stack.yml`. Se errar uma letra, o deploy falha.

---

## 2. Gerar os valores (antes de abrir o Portainer)

Você pode gerar no computador local (PowerShell, Git Bash ou Linux) e **colar** no Portainer.

### 2.1 `orbixlead_session_secret` (obrigatório)

```bash
openssl rand -hex 32
```

Exemplo de saída (não use este valor — gere o seu):

```text
a1b2c3d4e5f67890...
```

Guarde em um lugar seguro (gerenciador de senhas). Você **não** consegue ler o secret de volta depois no Docker.

### 2.2 `orbixlead_internal_api_key` (obrigatório)

Gere **outro** valor (não reutilize o session secret):

```bash
openssl rand -hex 32
```

A **API** e o **scraper** usam a mesma chave. Um secret só: `orbixlead_internal_api_key`.

### 2.3 `orbixlead_database_url` (obrigatório)

Monte a URL real do seu Postgres (troque usuário, senha, host e banco):

```text
postgresql://orbixlead:SUA_SENHA_FORTE@postgres:5432/orbixlead?schema=public
```

Observações:

- Se o Postgres for um serviço Docker na mesma rede Swarm, o host costuma ser o **nome do serviço** (ex.: `postgres`), não `localhost`.
- Se o Postgres estiver no host (fora do Swarm), use o endereço que a stack já usava (ex.: `host.docker.internal` ou IP interno).
- **Não** use placeholder tipo `ALTERE_A_SENHA` — a API recusa subir em produção com isso.

### 2.4 Opcionais

| Secret | Valor |
| --- | --- |
| `orbixlead_smtp_pass` | Senha/chave SMTP do Brevo |
| `orbixlead_super_admin_password` | Senha forte (≥ 10 chars, com letra e número) do primeiro super admin |

Se não criar o super admin por secret/env, use a tela `/setup` no primeiro acesso.

---

## 3. Criar os secrets no Portainer (UI)

Faça isto **antes** de criar/atualizar a stack do Orbixlead.

### 3.1 Abrir a área de Secrets

1. Entre no **Portainer**.
2. Selecione o ambiente **Swarm** (o cluster onde a stack sobe).
3. No menu lateral, vá em **Secrets**  
   (em algumas versões: **Swarm** → **Secrets**, ou **Resources** → **Secrets**).
4. Clique em **Add secret** / **+ Add secret**.

### 3.2 Criar `orbixlead_database_url`

1. **Name:** `orbixlead_database_url`  
   (copie e cole exatamente assim)
2. **Secret** / **Data:** cole a URL do Postgres completa (uma linha só).
3. **Não** marque opções desnecessárias; deixe o secret simples.
4. Clique em **Create secret** / **Add secret**.

### 3.3 Criar `orbixlead_session_secret`

1. **Name:** `orbixlead_session_secret`
2. **Secret:** cole o resultado do `openssl rand -hex 32`
3. Create.

### 3.4 Criar `orbixlead_internal_api_key`

1. **Name:** `orbixlead_internal_api_key`
2. **Secret:** cole o **outro** `openssl rand -hex 32`
3. Create.

### 3.5 (Opcional) Criar `orbixlead_smtp_pass`

1. **Name:** `orbixlead_smtp_pass`
2. **Secret:** senha SMTP do Brevo
3. Create.

Depois, no `docker-stack.yml` (ou no editor da stack no Portainer), **descomente**:

- em `api.environment`: `SMTP_PASS_FILE: /run/secrets/orbixlead_smtp_pass`
- em `api.secrets`: `- orbixlead_smtp_pass`
- no bloco final `secrets:`: `orbixlead_smtp_pass: { external: true }`

E preencha também `SMTP_USER` (e-mail/login Brevo) nas variáveis de ambiente da API.

### 3.6 (Opcional) Criar `orbixlead_super_admin_password`

1. **Name:** `orbixlead_super_admin_password`
2. **Secret:** senha forte do super admin
3. Create.

Depois descomente no YAML:

- `SUPER_ADMIN_EMAIL: admin@suaempresa.com` (preencha o e-mail real)
- `SUPER_ADMIN_PASSWORD_FILE: /run/secrets/orbixlead_super_admin_password`
- `- orbixlead_super_admin_password` em `api.secrets`
- `orbixlead_super_admin_password: { external: true }` no bloco `secrets:`

Se preferir, **pule** isso e use `https://seu-dominio/setup` no primeiro acesso.

### 3.7 Conferir

Na lista de Secrets você deve ver pelo menos:

- `orbixlead_database_url`
- `orbixlead_session_secret`
- `orbixlead_internal_api_key`

---

## 4. Subir / atualizar a stack no Portainer

1. Menu **Stacks**.
2. Se a stack **ainda não existe**:
   - **Add stack**
   - Nome: `orbixlead` (ou o nome que você já usa)
   - Cole o conteúdo do `docker-stack.yml` (ou use Web editor / Git, conforme seu fluxo)
   - **Deploy the stack**
3. Se a stack **já existe**:
   - Abra a stack → **Editor**
   - Atualize o YAML com a versão nova (com `*_FILE` e bloco `secrets:`)
   - **Update the stack**

A stack referencia secrets com `external: true`. Isso significa: **o Portainer não cria o secret por você** — ele só **usa** o que você criou no passo 3.

---

## 5. Variáveis que ficam no YAML (não são secret)

Estas continuam no `environment` da stack (não precisam de secret):

| Variável | Exemplo |
| --- | --- |
| `REDIS_URL` | `redis://redis:6379` |
| `WEB_ORIGIN` | `https://orbixlead.automacaodebaixocusto.com.br` |
| `COOKIE_SECURE` | `true` |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | seu usuário Brevo |
| `SMTP_FROM` | `Orbixlead <noreply@...>` |
| `API_URL` (scraper) | `http://api:4000` |
| `SCRAPER_MODE` | `playwright` |

Ajuste host do Redis/Postgres se na sua VPS os nomes dos serviços forem diferentes.

---

## 6. Como a aplicação lê o secret

No container, o Docker monta cada secret em:

```text
/run/secrets/<nome_do_secret>
```

A API/scraper leem via:

| Env na stack | Arquivo no container |
| --- | --- |
| `DATABASE_URL_FILE` | `/run/secrets/orbixlead_database_url` |
| `SESSION_SECRET_FILE` | `/run/secrets/orbixlead_session_secret` |
| `INTERNAL_API_KEY_FILE` | `/run/secrets/orbixlead_internal_api_key` |

Você **não** precisa colar a senha em variável de ambiente no Portainer. Só o caminho do arquivo.

---

## 7. Checklist rápido

- [ ] Swarm ativo no Portainer
- [ ] Secret `orbixlead_database_url` criado
- [ ] Secret `orbixlead_session_secret` criado (≥ 32 chars)
- [ ] Secret `orbixlead_internal_api_key` criado (≥ 16 chars; ideal ≥ 32)
- [ ] Nomes **iguais** aos do YAML
- [ ] Stack atualizada com o `docker-stack.yml` novo
- [ ] Rede `network_public` existe (external)
- [ ] (Opcional) SMTP configurado + secret `orbixlead_smtp_pass` + linhas descomentadas
- [ ] Serviços `api` / `web` / `scraper` saudáveis

---

## 8. Problemas comuns

### Stack não sobe: “secret ... not found”

O secret não existe no Swarm ou o **nome** está diferente.  
Volte em **Secrets**, confira o nome exato e crie de novo se precisar.

### API reinicia em loop / log: `env_validation_failed`

Em produção a API **recusa** segredo curto, vazio ou com texto tipo `altere` / `change-me`.  
Recrie o secret com valor forte (`openssl rand -hex 32`) e atualize a stack (force redeploy do serviço `api` se necessário).

### Como “trocar” o valor de um secret?

Docker Secrets são **imutáveis**. Fluxo:

1. Remova o serviço/stack que usa o secret (ou atualize depois).
2. Delete o secret antigo no Portainer.
3. Crie um secret **novo com o mesmo nome** e o valor novo.
4. Redeploy / Update da stack.

### Login / e-mails não chegam

Sem SMTP em produção, a API **não loga** o link de reset/convite (por segurança).  
Configure `SMTP_USER` + secret `orbixlead_smtp_pass` (e descomente as linhas no YAML).

### Redis pedindo senha?

Não. Nesta arquitetura o Redis fica **sem senha**, acessível só pela rede Docker.  
`REDIS_URL=redis://redis:6379` está correto se o serviço se chama `redis` na mesma rede.

---

## 9. Alternativa: criar secrets pelo console do Portainer (CLI)

Se preferir terminal (Host → Console no Portainer, ou SSH na VPS):

```bash
# Gere e crie session secret
openssl rand -hex 32 | docker secret create orbixlead_session_secret -

# Gere e crie internal api key
openssl rand -hex 32 | docker secret create orbixlead_internal_api_key -

# Database URL (cole a URL real entre as aspas)
printf '%s' 'postgresql://orbixlead:SENHA_FORTE@postgres:5432/orbixlead?schema=public' | docker secret create orbixlead_database_url -

# Opcionais
# printf '%s' 'SENHA_SMTP' | docker secret create orbixlead_smtp_pass -
# printf '%s' 'SenhaSuperAdmin1' | docker secret create orbixlead_super_admin_password -
```

Liste para confirmar:

```bash
docker secret ls | grep orbixlead
```

---

## 10. Ordem recomendada no dia do deploy

1. Gerar os 3 valores obrigatórios e anotar com segurança.  
2. Criar os 3 secrets no Portainer.  
3. (Opcional) Criar SMTP / super admin e descomentar no YAML.  
4. Deploy / Update da stack `orbixlead`.  
5. Abrir o site → login ou `/setup`.  
6. Testar: login, captura (scraper), e-mail de reset (se SMTP estiver ativo).

---

**Documento:** secrets + Portainer · Orbixlead CRM  
**Arquivo de stack:** [`docker-stack.yml`](./docker-stack.yml)  
**Relatório de segurança:** [`SEGURANCA-RELATORIO-E-PLANO.md`](./SEGURANCA-RELATORIO-E-PLANO.md)
