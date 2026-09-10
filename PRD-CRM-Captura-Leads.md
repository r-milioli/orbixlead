# PRD — Sistema de CRM de Captura de Leads
*(nome provisório: **LeadFlow CRM** — ajustar quando definir a marca)*

Versão: 1.0 · Status: MVP em especificação

---

## 1. Visão geral

Sistema multiempresa (multi-tenant) que captura leads de empresas via scraping bruto do Google Maps, qualifica automaticamente esses leads (frio/morno/quente), e disponibiliza um CRM em formato Kanban para conduzir a negociação até a conversão — com mensageria integrada via WhatsApp e um dashboard de acompanhamento de metas e desempenho.

**Problema que resolve:** afiliados e vendedores que fazem prospecção ativa (outbound) precisam de uma ferramenta que una descoberta de leads qualificados + funil de vendas + mensageria, sem depender de planilhas manuais ou ferramentas fragmentadas.

**Modelo de negócio:** SaaS por créditos. Pacotes de 500, 1.500 e 5.000 leads/mês, liberados manualmente pelo super admin (sem checkout automatizado no MVP). Existe também um modo livre, não vendido.

---

## 2. Escopo do MVP

Sem cortes de escopo — todas as funcionalidades abaixo entram na primeira versão, por decisão do time.

---

## 3. Stack técnica

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | React + Next.js | Biblioteca de componentes Mantine |
| Backend | Node.js (Express ou Fastify) | Serviço separado do frontend |
| Banco de dados | PostgreSQL | |
| Fila assíncrona | BullMQ + Redis | Processa as buscas de scraping sem travar a UI |
| Scraping | Headless browser (Playwright ou Puppeteer) | Simula navegação real para reduzir bloqueio |
| Infraestrutura de scraping | VPS isolada, fora do Docker Swarm principal | Reduz risco de IP banido afetar outros produtos |
| Mensageria | Link direto `wa.me` com mensagem pré-preenchida | Sem API oficial nem automação não-oficial no MVP |

**Fonte de dados:** Google Maps / Google Meu Negócio, via scraping bruto (sem API oficial do Google).

---

## 4. Design

- Biblioteca de UI: **Mantine**
- Cor principal: **#15AABF**
- Ícones: **Lucide Icons**, estilo outline
- Idioma da interface: **português (BR)** apenas no MVP

---

## 5. Modelo de dados (visão geral)

Entidades principais e relacionamentos:

- **Tenants** (contas/empresas) — isolamento multiempresa via `tenant_id` em praticamente toda tabela
- **Users** — usuários vinculados a um tenant, com papel `admin` ou `operador`
- **Credits** — saldo de créditos por tenant (tabela própria, preparada para futuro histórico de consumo)
- **Pipeline_Stages** — estágios do Kanban, customizáveis por tenant (usuário pode renomear/reordenar)
- **Leads** — capturados via scraping, vinculados a um estágio do pipeline e à busca de origem (`scraping_job_id`); identificador único: **telefone + nome da empresa**, escopado por tenant
- **Message_Templates** — templates de mensagem com variáveis dinâmicas (`{nome}`, `{empresa}`)
- **Schedules** — agendamentos de retorno vinculados a um lead (um lead pode ter vários ao longo do tempo)
- **Scraping_Jobs** — registro de cada busca disparada (país, cidade, segmentação, quantidade, solicitante)

*(Diagrama ER completo já validado na etapa de design técnico.)*

---

## 6. Funcionalidades detalhadas

### 6.1 Dashboard — Painel de desempenho

- **Métricas principais:** taxa de conversão, custo por conversão, leads nos últimos 7 dias, convertidos nos últimos 7 dias
- **Funil de conversão:** total → agendados → abordados → follow up → perdidos → convertidos, com representação visual do funil
- **Origem:** capturas em movimento no dia
- **Prospecção (30 dias):** gráfico de barras comparando leads importados vs. convertidos
- **Funil de vendas do CRM:** métricas de progressão (total, abordados, agendados, follow up, perdidos, convertidos)
- **Conversão por categoria:** indica onde vale mais a pena investir
- **Cards do dia:** importados hoje, avançaram hoje
- **Meta mensal:** barra de progresso "X de Y conversões no mês"

### 6.2 Página de Metas

- Formulário: nome da meta, mês, período, conversões-alvo
- Precificação por venda: preço de venda, cálculo automático de lucro e percentual
- Faturamento calculado: total da meta, custo total para alcançá-la, lucro previsto
- Dados analíticos de progresso da meta

### 6.3 Captura de lead

- Formulário: país (default Brasil), cidade, segmentação, quantidade desejada
- Resultado em cards, cada um com: bandeira do país, nome da empresa, tag de temperatura (frio/morno/quente), estrelas, telefone, cidade/país, tag "sem site", endereço, URLs de redes sociais (se houver)
- Seleção individual ou em lote (checkbox), com opções de excluir ou enviar para o CRM

**Regra de qualificação de temperatura:**
| Condição | Tag |
|---|---|
| Muita avaliação + redes sociais + site configurado | **Frio** (bem posicionado, baixa prioridade) |
| Sem site + baixa qualificação | **Quente** (alta prioridade) |
| Muita qualificação + sem site + com redes sociais | **Morno** |

**Deduplicação:** identificador único = telefone + nome da empresa. Lead já existente no tenant não consome crédito novamente.

**Consumo de crédito:** 1 crédito por lead novo e único identificado (não por lead retornado na busca).

### 6.4 CRM Kanban

- Leads entram no início do pipeline
- Cada card tem botão de ligar e botão de WhatsApp (abre modal de escolha de template), além de nome da empresa, cidade e nicho
- Drag-and-drop entre estágios (estágios customizáveis pelo usuário — pode renomear e reordenar)
- Clique no card completo abre a página do lead: dados completos + preview da mensagem no template escolhido
- Botão de agendamento: dia, hora e motivo do retorno, com campo de texto longo para anotações

### 6.5 Página de Mensagens

- Criação de templates com variáveis dinâmicas entre chaves: `{nome}`, `{empresa}`
- Botão de WhatsApp no Kanban abre `wa.me` com a mensagem já preenchida a partir do template escolhido

### 6.6 Configurações

- Página de configuração do usuário logado
- Notificações por e-mail: criação de conta, convite de colaborador, alertas

---

## 7. Créditos e multiempresa

- Pacotes: 500, 1.500 e 5.000 leads/mês — liberados **manualmente** pelo super admin (sem checkout automatizado no MVP)
- Modo livre (não vendido) também existe no sistema
- Cada conta pode cadastrar colaboradores, que consomem os mesmos créditos da conta
- **Papéis de colaborador:**
  - **Admin:** gerencia créditos, templates e colaboradores
  - **Operador:** usa apenas captura de leads e Kanban
- **Créditos esgotados:** sistema bloqueia novas buscas até liberação manual pelo super admin

---

## 8. Regras de negócio consolidadas

| Regra | Decisão |
|---|---|
| Identificação de lead duplicado | Telefone + nome da empresa, escopado por tenant |
| Consumo de crédito | Por lead novo e único (não por resultado bruto da busca) |
| Isolamento de dados | Multi-tenant, banco compartilhado, `tenant_id` em cada tabela |
| Bloqueio por falta de crédito | Bloqueia novas buscas até liberação manual |
| Tratamento de dados capturados (LGPD) | Tratado como dado público de empresa (B2B) — sem fluxo de remoção automatizado no MVP. **Risco a monitorar**, não uma ausência de risco. |
| Mensageria | Link `wa.me`, sem envio automático — usuário confirma o disparo manualmente |

---

## 9. Fora de escopo (MVP)

- Checkout / gateway de pagamento (créditos liberados manualmente)
- API oficial do WhatsApp Business ou automação não-oficial (Baileys/whatsapp-web.js)
- Suporte a múltiplos idiomas de interface
- Fluxo automatizado de remoção de dados (solicitação de descadastro)

---

## 10. Riscos conhecidos

- **Scraping sem API oficial:** sujeito a bloqueio, mudança de estrutura do Google e necessidade de manutenção contínua do headless browser
- **LGPD:** ainda que os dados sejam de empresas (B2B), há exposição caso o Google trate parte da informação como dado pessoal (ex: nome de contato dentro do card)
- **Escopo completo sem cortes:** aumenta o tempo até o primeiro teste real com usuário — vale reavaliar se o cronograma apertar
