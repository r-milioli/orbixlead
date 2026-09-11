# Design System — Orbixlead CRM

**Versão:** 1.0  
**Status:** Base visual e funcional para implementação do MVP  
**Stack obrigatória:** React + Next.js + Mantine  
**Biblioteca de ícones:** Lucide Icons  
**Idioma:** Português (BR)  
**Cor primária:** `#15AABF`

---

# 1. Princípios do Design

O Orbixlead CRM deve transmitir:

- Clareza
- Velocidade
- Organização
- Profissionalismo
- Controle
- Baixa carga cognitiva
- Alta densidade de informação sem aparência poluída

A interface deve parecer uma ferramenta SaaS profissional de CRM, e não um painel administrativo genérico.

## 1.1 Regras obrigatórias

- Utilizar **Mantine** para componentes de interface.
- Utilizar **Lucide Icons** exclusivamente para ícones.
- Todos os ícones devem utilizar estilo **outline**.
- Não utilizar emojis.
- Não utilizar ícones Unicode como substitutos de ícones.
- Não utilizar gradientes decorativos.
- Não utilizar sombras exageradas.
- Não utilizar bordas excessivamente arredondadas.
- Não utilizar estilos padrão do navegador.
- Todos os elementos interativos devem possuir estados de hover, focus, active, disabled e loading quando aplicável.
- Todos os inputs devem possuir aparência customizada.
- Todos os scrollbars visíveis devem possuir estilização própria.
- O idioma da interface é exclusivamente português brasileiro.

---

# 2. Tokens de Design

## 2.1 Cores

### Brand

```text
Primary:       #15AABF
Primary Hover: #1098AD
Primary Dark:  #0C8599
Primary Light: #E3FAFC
```

### Background

```text
Background:        #F8F9FA
Surface:           #FFFFFF
Surface Secondary: #F1F3F5
Surface Hover:     #F8F9FA
```

### Texto

```text
Text Primary:   #212529
Text Secondary: #495057
Text Muted:     #868E96
Text Disabled:  #ADB5BD
```

### Bordas

```text
Border:       #DEE2E6
Border Light: #E9ECEF
Border Focus: #15AABF
```

### Estados

```text
Success: #2F9E44
Success Background: #EBFBEE

Warning: #F08C00
Warning Background: #FFF4E6

Danger: #E03131
Danger Background: #FFF5F5

Info: #15AABF
Info Background: #E3FAFC
```

---

# 3. Tipografia

Utilizar uma fonte sans-serif moderna e altamente legível.

Hierarquia:

```text
Display: 32px / 700
H1:      28px / 700
H2:      24px / 700
H3:      20px / 600
H4:      18px / 600

Body Large: 16px / 400
Body:       14px / 400
Body Small: 13px / 400

Label:      13px / 600
Caption:    12px / 400
```

### Regras

- Títulos devem possuir peso 600 ou 700.
- Corpo de texto deve utilizar peso 400.
- Labels devem possuir peso 500/600.
- Nunca utilizar texto em caixa alta em excesso.
- Números de métricas devem utilizar peso 700.

---

# 4. Espaçamento

Utilizar escala baseada em 4px:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Regra geral:

```text
xs = 4px
sm = 8px
md = 12px
lg = 16px
xl = 24px
xxl = 32px
```

---

# 5. Border Radius

A interface deve ser levemente arredondada, sem aparência excessivamente "soft".

```text
xs: 4px
sm: 6px
md: 8px
lg: 10px
xl: 12px
```

Padrões:

- Input: 6px
- Button: 6px
- Card: 8px
- Modal: 10px
- Drawer: 0px no lado conectado à tela
- Badge: 999px

---

# 6. Sombras

Utilizar sombras discretas.

```text
Shadow XS:
0 1px 2px rgba(0,0,0,.04)

Shadow SM:
0 2px 6px rgba(0,0,0,.06)

Shadow MD:
0 8px 24px rgba(0,0,0,.08)

Shadow LG:
0 16px 40px rgba(0,0,0,.12)
```

A sombra deve servir para indicar elevação, não decoração.

---

# 7. Ícones

Biblioteca obrigatória:

**Lucide Icons**

Todos os ícones devem:

- possuir estilo outline;
- utilizar stroke;
- respeitar a cor do contexto;
- possuir espessura visual consistente;
- nunca utilizar emoji.

## Ícones principais

```text
Dashboard       LayoutDashboard
Leads           Users
Captura         Search
CRM             KanbanSquare
Mensagens       MessageSquare
Metas           Target
Configurações   Settings
Usuários        UserRound
Créditos        Coins
Notificações    Bell
Menu            Menu
Fechar          X
Adicionar       Plus
Editar          Pencil
Excluir         Trash2
Buscar          Search
Filtro          SlidersHorizontal
Telefone        Phone
WhatsApp        MessageCircle
Calendário      Calendar
Relógio         Clock
Mais opções     MoreHorizontal
Voltar          ArrowLeft
Avançar         ArrowRight
Download        Download
Upload          Upload
```

Tamanho padrão:

```text
16px — ações secundárias
18px — ações principais
20px — navegação
24px — destaque
```

---

# 8. Layout Global

O sistema utiliza estrutura:

```text
┌────────────────────────────────────────────────────┐
│                    TOPBAR                          │
├───────────────┬────────────────────────────────────┤
│               │                                    │
│   SIDEBAR     │           CONTENT                  │
│               │                                    │
│               │                                    │
│               │                                    │
└───────────────┴────────────────────────────────────┘
```

---

# 9. Sidebar

A sidebar é um componente obrigatório e retrátil.

## Estado expandido

```text
Largura: 248px
```

Exibe:

- Logo
- Nome do sistema
- Navegação
- Indicador de página ativa
- Informações da conta
- Créditos
- Botão de recolher

## Estado recolhido

```text
Largura: 72px
```

Exibe:

- Apenas ícones
- Tooltip ao passar o mouse
- Logo reduzida
- Botão de expansão

## Navegação

```text
Dashboard

Prospecção
  Capturar Leads
  Leads Capturados

CRM
  Pipeline
  Mensagens
  Agenda

Gestão
  Metas

Configurações
```

### Item ativo

```text
background: #E3FAFC
color: #0C8599
```

O item ativo deve possuir também um indicador lateral de 3px.

### Hover

```text
background: #F1F3F5
```

---

# 10. Topbar

A barra superior deve conter:

```text
[menu]        Título da página             [notificações] [avatar]
```

No desktop:

- botão da sidebar;
- breadcrumb quando necessário;
- título;
- ações da página;
- notificações;
- perfil.

No mobile:

```text
[menu] [título] [avatar]
```

---

# 11. Avatar

Estados:

- imagem;
- iniciais;
- loading.

Tamanhos:

```text
sm: 32px
md: 40px
lg: 48px
```

O menu do usuário será aberto através de um dropdown.

---

# 12. Dropdown

Todos os dropdowns devem utilizar o componente de menu do Mantine.

Características:

- fundo branco;
- borda `#DEE2E6`;
- radius 8px;
- sombra discreta;
- padding 6px;
- itens com altura mínima de 36px.

Estrutura:

```text
┌─────────────────────────────┐
│ Perfil                      │
│ Configurações               │
│─────────────────────────────│
│ Sair                        │
└─────────────────────────────┘
```

---

# 13. Dropdown com Scroll Customizado

Dropdowns extensos não devem utilizar scrollbar padrão.

Exemplo:

```text
max-height: 280px;
overflow-y: auto;
```

Scrollbar:

```text
width: 6px;
track: transparent;
thumb: #CED4DA;
thumb-hover: #ADB5BD;
```

Aplicar especialmente em:

- seleção de cidades;
- países;
- segmentos;
- templates;
- colaboradores;
- filtros;
- listas extensas.

---

# 14. Menu Contextual Escondido

Ações secundárias devem ser escondidas dentro de um menu:

```text
[ ... ]
```

Ao clicar:

```text
┌─────────────────────────────┐
│ Editar                      │
│ Duplicar                    │
│ Arquivar                    │
│─────────────────────────────│
│ Excluir                     │
└─────────────────────────────┘
```

O menu deve aparecer próximo ao botão e nunca sair da viewport.

A ação destrutiva deve possuir cor `#E03131`.

---

# 15. Botões

## Primary

```text
background: #15AABF
color: #FFFFFF
```

Uso:

- Capturar leads
- Salvar
- Criar meta
- Criar template

## Secondary

```text
background: #FFFFFF
border: 1px solid #DEE2E6
color: #343A40
```

## Subtle

Sem borda.

Uso:

- ações secundárias;
- cancelar;
- navegação.

## Danger

```text
background: #E03131
color: #FFFFFF
```

## Ghost

Fundo transparente.

---

# 16. Estados dos Botões

Todo botão deve possuir:

```text
Default
Hover
Active
Focus
Disabled
Loading
```

Durante loading:

```text
[spinner] Processando...
```

O texto não deve desaparecer durante o carregamento.

---

# 17. Inputs

Todos os inputs devem remover a aparência padrão do navegador.

Características:

```text
height: 40px
border: 1px solid #DEE2E6
border-radius: 6px
background: #FFFFFF
```

Focus:

```text
border-color: #15AABF
box-shadow: 0 0 0 2px rgba(21,170,191,.12)
```

Erro:

```text
border-color: #E03131
```

Disabled:

```text
background: #F1F3F5
color: #ADB5BD
```

---

# 18. Textarea

Mesmo padrão dos inputs.

Altura mínima:

```text
120px
```

Resize:

```text
vertical
```

Aplicar principalmente em:

- anotações;
- templates;
- mensagens;
- observações de agendamento.

---

# 19. Select

Utilizar Mantine Select.

Nunca utilizar `<select>` puro do navegador.

Características:

- dropdown customizado;
- busca quando houver muitos itens;
- scroll customizado;
- estado vazio;
- estado loading.

---

# 20. Combobox

Utilizar para:

- cidade;
- país;
- segmento;
- colaboradores;
- templates.

Permitir:

```text
digitação
busca
seleção
limpeza
```

---

# 21. Checkbox

Utilizar Mantine.

Estados:

```text
unchecked
checked
indeterminate
disabled
```

O estado checked utiliza:

```text
#15AABF
```

---

# 22. Radio

Utilizar Mantine.

Uso:

- escolha de template;
- tipo de visualização;
- opções exclusivas.

---

# 23. Switch

Utilizado para:

- notificações;
- configurações;
- preferências.

---

# 24. Badge / Tags

## Temperatura

### Frio

```text
background: #E7F5FF
color: #1971C2
```

### Morno

```text
background: #FFF3BF
color: #E67700
```

### Quente

```text
background: #FFE3E3
color: #C92A2A
```

O badge deve conter apenas texto.

---

# 25. Card

Padrão:

```text
background: #FFFFFF
border: 1px solid #E9ECEF
border-radius: 8px
```

Padding:

```text
16px
```

Hover, quando clicável:

```text
border-color: #CED4DA
box-shadow: Shadow SM
```

---

# 26. Cards de Métricas

Dashboard:

```text
┌─────────────────────────────┐
│ Leads nos últimos 7 dias    │
│                             │
│ 1.248                       │
│ +12,4%                      │
└─────────────────────────────┘
```

Estrutura:

- label;
- valor;
- indicador de variação;
- ícone;
- informação auxiliar opcional.

---

# 27. KPI

KPI deve utilizar:

```text
valor grande
descrição pequena
variação
```

Exemplos:

```text
Taxa de conversão
18,4%

Custo por conversão
R$ 42,80

Leads capturados
1.284

Convertidos
236
```

---

# 28. Alertas

Utilizar Mantine Alert.

Tipos:

```text
Info
Success
Warning
Error
```

Nunca utilizar emojis.

Exemplo:

```text
Créditos esgotados

Sua conta não possui créditos suficientes
para realizar uma nova captura.
```

---

# 29. Toast

O sistema deve utilizar notificações toast no **canto superior direito**.

Posição:

```text
top-right
```

Características:

```text
width: 360px
border-radius: 8px
shadow: Shadow MD
```

Tipos:

### Sucesso

```text
Lead adicionado ao CRM.
```

### Erro

```text
Não foi possível realizar a captura.
```

### Informação

```text
A captura foi adicionada à fila.
```

### Aviso

```text
Você possui apenas 42 créditos restantes.
```

O toast deve possuir:

```text
ícone Lucide
título opcional
mensagem
botão de fechar
barra de progresso opcional
```

---

# 30. Modal

Utilizar Mantine Modal.

Modal padrão:

```text
width: 520px
radius: 10px
```

Estrutura:

```text
┌──────────────────────────────────────┐
│ Título                           X   │
│──────────────────────────────────────│
│                                      │
│ Conteúdo                             │
│                                      │
│──────────────────────────────────────│
│                 Cancelar   Confirmar │
└──────────────────────────────────────┘
```

---

# 31. Modal de Confirmação

Utilizado antes de:

- excluir lead;
- excluir template;
- excluir colaborador;
- ações irreversíveis.

Exemplo:

```text
Excluir lead?

Esta ação não poderá ser desfeita.

Cancelar                  Excluir
```

Ação destrutiva em vermelho.

---

# 32. Modal de Template WhatsApp

Quando o usuário clicar no botão WhatsApp dentro do Kanban:

```text
┌─────────────────────────────────────┐
│ Enviar mensagem                     │
│─────────────────────────────────────│
│                                     │
│ Selecione um template               │
│ [ Primeiro contato              v ] │
│                                     │
│ Preview                             │
│ ┌─────────────────────────────────┐ │
│ │ Olá, João. Tudo bem?            │ │
│ │                                 │ │
│ │ Notei que a empresa Empresa X   │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
│                                     │
│              Cancelar  Abrir WhatsApp│
└─────────────────────────────────────┘
```

O botão final abre `wa.me` com mensagem preenchida.

---

# 33. Drawer

Drawer será utilizado para informações e edição contextual sem abandonar a página.

Utilizações:

- detalhes rápidos do lead;
- edição de lead;
- filtros avançados;
- detalhes de captura;
- criação/edição rápida.

Desktop:

```text
width: 480px
```

Em telas pequenas:

```text
width: 100%
```

Estrutura:

```text
┌──────────────────────────────┐
│ Detalhes do Lead         X   │
├──────────────────────────────┤
│                              │
│ Empresa                      │
│ Empresa XPTO                 │
│                              │
│ Telefone                     │
│ (21) 99999-9999              │
│                              │
│ Cidade                       │
│ Rio de Janeiro               │
│                              │
├──────────────────────────────┤
│          Salvar alterações   │
└──────────────────────────────┘
```

---

# 34. Drawer de Filtros

Filtros avançados devem aparecer em Drawer.

```text
Filtros

Temperatura
[ ] Frio
[ ] Morno
[ ] Quente

Origem
[________________]

Cidade
[________________]

Segmento
[________________]

[Limpar filtros]

[Aplicar filtros]
```

---

# 35. Tooltip

Utilizar Mantine Tooltip.

Uso:

- sidebar recolhida;
- ícones sem texto;
- ações compactas;
- informações auxiliares.

Nunca utilizar tooltip para conteúdo essencial.

---

# 36. Breadcrumb

Exemplo:

```text
Dashboard / CRM / Pipeline
```

Apenas páginas que possuam hierarquia clara devem utilizar breadcrumb.

---

# 37. Tabs

Utilizar Mantine Tabs.

Uso:

```text
Informações
Atividades
Agendamentos
Histórico
```

Tab ativa:

```text
color: #15AABF
border-bottom: 2px solid #15AABF
```

---

# 38. Loading

Utilizar componentes Mantine.

Estados:

- Skeleton;
- Loader;
- Progress;
- Button loading.

Não utilizar telas completamente brancas durante carregamentos.

---

# 39. Skeleton

Para cards:

```text
████████████
████████
████████████████
```

O skeleton deve preservar a estrutura final da interface.

---

# 40. Empty State

Toda listagem deve possuir estado vazio.

Exemplo:

```text
Nenhum lead encontrado

Ainda não existem leads capturados
com esses filtros.

[Capturar leads]
```

Usar Lucide Icon outline.

Não utilizar ilustrações exageradas.

---

# 41. Error State

Exemplo:

```text
Não foi possível carregar os leads

Ocorreu um problema ao buscar os dados.

[Tentar novamente]
```

---

# 42. Paginação

Obrigatória nas listas.

Estrutura:

```text
← Anterior   1  2  3  4  5   Próxima →
```

Em listas grandes:

```text
1 ... 4 5 6 ... 20
```

Também exibir:

```text
Mostrando 1–25 de 248 leads
```

Opcionalmente:

```text
Itens por página
[25 v]
```

Nunca utilizar paginação nativa do navegador.

---

# 43. Tabela

Tabelas devem ser utilizadas quando a visualização tabular for mais eficiente que cards.

Exemplo:

```text
┌────┬──────────────────┬─────────┬───────────┬─────────┐
│ □  │ Empresa          │ Cidade  │ Temper.   │ Ações   │
├────┼──────────────────┼─────────┼───────────┼─────────┤
│ □  │ Empresa A        │ Niterói │ Quente    │ ...     │
│ □  │ Empresa B        │ Rio     │ Morno     │ ...     │
└────┴──────────────────┴─────────┴───────────┴─────────┘
```

Cabeçalho:

```text
background: #F8F9FA
```

---

# 44. Captura de Leads

A página deve seguir:

```text
Título
Descrição

┌────────────────────────────────────────────┐
│ Nova captura                               │
│                                            │
│ País       Cidade                          │
│ [Brasil]   [________________]              │
│                                            │
│ Segmentação       Quantidade               │
│ [___________]     [100]                    │
│                                            │
│                         [Capturar leads]   │
└────────────────────────────────────────────┘
```

Após iniciar:

```text
Captura adicionada à fila

Processando sua busca...
```

O processamento ocorre de forma assíncrona utilizando BullMQ + Redis conforme a arquitetura do PRD.

---

# 45. Lead Card

Cada lead deve possuir:

```text
Bandeira
Nome da empresa
Temperatura
Estrelas
Telefone
Cidade / País
Sem site
Endereço
Redes sociais
```

Ações:

```text
[Telefone]
[WhatsApp]
[...]
```

A estrutura segue os dados definidos para os resultados de captura no PRD.

---

# 46. CRM Kanban

Estrutura:

```text
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ NOVOS       │ ABORDADOS   │ FOLLOW UP   │ CONVERTIDOS │
│ 24          │ 18          │ 12          │ 8           │
│             │             │             │             │
│ [Lead]      │ [Lead]      │ [Lead]      │ [Lead]      │
│ [Lead]      │ [Lead]      │ [Lead]      │             │
│ [Lead]      │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

# 47. Kanban Column

Características:

```text
background: #F1F3F5
border-radius: 8px
padding: 8px
```

Header:

```text
Nome do estágio
Quantidade
Menu
```

---

# 48. Kanban Card

```text
┌──────────────────────────────┐
│ Empresa XPTO             ... │
│                              │
│ Rio de Janeiro               │
│ Restaurante                  │
│                              │
│ [Quente]                     │
│                              │
│ Phone   WhatsApp             │
└──────────────────────────────┘
```

Drag:

```text
cursor: grab
```

Durante drag:

```text
opacity: .65
transform: rotate(1deg)
shadow: Shadow MD
```

Drop zone:

```text
border: 1px dashed #15AABF
background: #E3FAFC
```

---

# 49. Pipeline Customizável

O usuário poderá:

- renomear estágio;
- reordenar estágio;
- criar estágio;
- excluir estágio quando permitido.

Esses estágios são customizáveis por tenant conforme especificado no PRD.

---

# 50. Página de Lead

Estrutura:

```text
← Voltar

Empresa XPTO
[Quente]

──────────────────────────────

Informações
Telefone
Cidade
Endereço
Site
Redes sociais

──────────────────────────────

Mensagem

Template
[Primeiro contato]

Preview
...

──────────────────────────────

Agendamento

Data
Hora
Motivo
Anotações

[Agendar retorno]
```

---

# 51. Agendamento

Campos:

```text
Data
Hora
Motivo
Anotações
```

A área de anotações deve utilizar textarea.

---

# 52. Dashboard

Estrutura:

```text
Dashboard

[Metric 1] [Metric 2] [Metric 3] [Metric 4]

┌────────────────────────┐
│ Funil de conversão     │
│                        │
│ Total                  │
│ ██████████████████     │
│                        │
│ Agendados              │
│ █████████████           │
│                        │
│ Convertidos            │
│ ██████                  │
└────────────────────────┘

┌─────────────────────────────────────┐
│ Prospecção — últimos 30 dias        │
│                                     │
│ gráfico de barras                   │
└─────────────────────────────────────┘
```

Os gráficos devem representar as métricas previstas no PRD: conversão, custo por conversão, leads recentes, funil e prospecção.

---

# 53. Gráficos

Utilizar visualização simples.

Não utilizar:

- 3D;
- gradientes;
- excesso de cores;
- efeitos decorativos.

A cor principal pode representar a série principal.

Cores secundárias devem respeitar os tokens de estado.

---

# 54. Meta Mensal

Componente:

```text
Meta mensal

148 de 200 conversões

██████████████████░░░░

74%
```

Deve apresentar:

- meta;
- realizado;
- percentual;
- progresso;
- previsão quando disponível.

---

# 55. Página de Metas

Formulário:

```text
Nome da meta
Mês
Período
Conversões alvo

Preço de venda

Resultado:

Faturamento previsto
Custo previsto
Lucro previsto
Margem
```

Esses campos refletem o modelo definido no PRD.

---

# 56. Mensagens

Lista:

```text
Templates

[+ Novo template]

┌───────────────────────────────────┐
│ Primeiro contato                  │
│ Olá, {nome}...                    │
│                                   │
│ [Editar] [ ... ]                 │
└───────────────────────────────────┘
```

Variáveis suportadas inicialmente:

```text
{nome}
{empresa}
```

Conforme definido no PRD.

---

# 57. Template Editor

Campos:

```text
Nome do template

Mensagem

[Olá {nome}, tudo bem?]

Variáveis disponíveis

{nome}
{empresa}
```

Ao clicar na variável, inserir automaticamente no textarea.

Preview em tempo real:

```text
Preview

Olá João, tudo bem?

Vi a empresa Empresa XPTO...
```

---

# 58. Créditos

O saldo deve estar sempre disponível no contexto da conta.

Exemplo:

```text
Créditos

1.284 / 1.500

█████████████████░░
```

Estados:

### Normal

Saldo acima de 20%.

### Atenção

Saldo entre 10% e 20%.

### Crítico

Saldo abaixo de 10%.

### Bloqueado

Saldo igual a zero.

O PRD define pacotes de 500, 1.500 e 5.000 leads e bloqueio de novas buscas quando os créditos acabam.

---

# 59. Estado de Créditos Esgotados

Ao tentar realizar nova captura:

```text
Créditos esgotados

Sua conta não possui créditos suficientes
para realizar uma nova busca.

Entre em contato com o administrador
para solicitar a liberação de créditos.

[Entendi]
```

Não exibir botão de checkout, pois checkout está fora do escopo do MVP.

---

# 60. Notificações

Dropdown:

```text
Notificações

Nova captura concluída
Há 2 minutos

Meta mensal atualizada
Há 1 hora

────────────────

Ver todas
```

Estados:

```text
não lida
lida
vazia
```

---

# 61. Perfil

Menu:

```text
Nome do usuário
Admin

Meu perfil
Configurações
Sair
```

Papéis:

```text
Admin
Operador
```

O Admin possui gerenciamento de créditos, templates e colaboradores; o Operador possui acesso à captura e Kanban.

---

# 62. Controle de Permissões

Componentes devem respeitar o papel do usuário.

## Admin

Pode acessar:

```text
Dashboard
Captura
CRM
Mensagens
Metas
Colaboradores
Créditos
Configurações
```

## Operador

Pode acessar:

```text
Captura
CRM
```

A interface não deve apenas esconder botões: as permissões devem também ser protegidas no backend.

---

# 63. Responsividade

## Desktop

```text
≥ 1200px
```

Sidebar expandida por padrão.

## Tablet

```text
768px — 1199px
```

Sidebar recolhida.

## Mobile

```text
< 768px
```

Sidebar transforma-se em Drawer.

O Kanban deve permitir scroll horizontal.

---

# 64. Mobile Sidebar

No mobile:

```text
[Menu]
```

abre:

```text
┌──────────────────────┐
│ Orbixlead CRM      X  │
│                      │
│ Dashboard            │
│ Capturar Leads       │
│ CRM                  │
│ Mensagens            │
│ Metas                │
│ Configurações        │
└──────────────────────┘
```

---

# 65. Scrollbar Global

Proibido utilizar aparência padrão do navegador.

Scrollbar:

```text
width: 6px
height: 6px
```

Track:

```text
transparent
```

Thumb:

```text
#CED4DA
```

Hover:

```text
#ADB5BD
```

Aplicar em:

- body;
- sidebar;
- dropdowns;
- drawers;
- modais;
- Kanban;
- tabelas;
- listas.

---

# 66. Focus

Todos os elementos interativos precisam possuir foco visível.

Padrão:

```text
outline: none;
box-shadow:
0 0 0 2px #FFFFFF,
0 0 0 4px rgba(21,170,191,.35);
```

Nunca remover foco sem substituí-lo por outro indicador visual.

---

# 67. Estados Globais

Todo componente interativo deve considerar:

```text
Default
Hover
Active
Focus
Disabled
Loading
Error
Empty
```

Quando aplicável:

```text
Selected
Dragging
Expanded
Collapsed
```

---

# 68. Z-Index

Escala recomendada:

```text
Base:          0
Sticky:        10
Dropdown:      100
Tooltip:       200
Toast:         300
Modal overlay: 400
Modal:         410
Drawer overlay: 400
Drawer:        410
```

---

# 69. Overlay

Modais e drawers devem utilizar overlay customizado:

```text
background:
rgba(15, 23, 42, 0.45)
```

O overlay deve impedir interação com o conteúdo atrás.

---

# 70. Animações

Animações devem ser rápidas e discretas.

```text
Fast: 120ms
Normal: 180ms
Slow: 240ms
```

Usos:

- dropdown;
- modal;
- drawer;
- sidebar;
- hover;
- toast.

Evitar animações exageradas.

---

# 71. Sidebar Animation

Expandir:

```text
72px → 248px
```

Transição:

```text
180ms ease
```

O conteúdo deve acompanhar a alteração sem causar saltos.

---

# 72. Toast Animation

Entrada:

```text
translateX(24px)
opacity: 0
```

Final:

```text
translateX(0)
opacity: 1
```

Saída:

```text
translateX(24px)
opacity: 0
```

---

# 73. Form Validation

Mensagens sempre em português.

Exemplos:

```text
Este campo é obrigatório.

Informe uma quantidade válida.

Selecione uma cidade.

O nome do template deve ser informado.
```

Nunca utilizar mensagens técnicas para o usuário final.

---

# 74. Confirmações

Ações destrutivas devem exigir confirmação.

Exemplo:

```text
Excluir template?

O template "Primeiro contato" será excluído
permanentemente.

Cancelar
Excluir template
```

---

# 75. Padrão de Página

Todas as páginas devem seguir:

```text
Page Header
    Título
    Descrição
    Ações

Content
    Cards
    Filtros
    Tabela / Grid / Kanban

Pagination
```

---

# 76. Page Header

Exemplo:

```text
Capturar Leads

Encontre novos leads qualificados
para sua prospecção.

                         [Nova captura]
```

---

# 77. Filtros

Filtros rápidos devem aparecer no topo da listagem:

```text
[Buscar...] [Temperatura v] [Cidade v] [Filtros]
```

Filtros avançados:

```text
[Filtros]
```

abre Drawer.

---

# 78. Busca

Campo:

```text
[ Search  Buscar empresa, telefone... ]
```

Debounce recomendado para buscas remotas.

---

# 79. Seleção em Massa

Quando houver seleção:

```text
3 leads selecionados

[Adicionar ao CRM]
[Excluir]
```

A barra de ações deve aparecer somente quando houver itens selecionados.

---

# 80. Banner de Seleção

```text
┌─────────────────────────────────────────────┐
│ 12 leads selecionados                       │
│                           Excluir  Adicionar │
└─────────────────────────────────────────────┘
```

---

# 81. Links

Links devem utilizar:

```text
#0C8599
```

Hover:

```text
#15AABF
```

Nunca utilizar azul padrão do navegador.

---

# 82. Estados de Link Externo

Links para:

- site;
- Instagram;
- Facebook;
- outras redes;
- WhatsApp.

Devem possuir ícones Lucide apropriados quando disponíveis.

---

# 83. WhatsApp

O WhatsApp não será automatizado.

O sistema apenas abrirá o link `wa.me` com a mensagem pré-preenchida, conforme regra do MVP.

Fluxo:

```text
Kanban
   ↓
WhatsApp
   ↓
Modal de template
   ↓
Preview
   ↓
Abrir WhatsApp
   ↓
wa.me
```

---

# 84. Sistema de Feedback

Toda ação relevante deve fornecer feedback.

Exemplos:

```text
Lead criado
Lead movido
Template salvo
Meta criada
Agendamento realizado
Captura iniciada
Captura concluída
Erro na captura
Créditos insuficientes
```

---

# 85. Arquitetura de Componentes

Estrutura recomendada:

```text
components/
│
├── layout/
│   ├── AppShell
│   ├── Sidebar
│   ├── Topbar
│   ├── UserMenu
│   └── Breadcrumb
│
├── navigation/
│   ├── NavItem
│   ├── DropdownMenu
│   ├── Pagination
│   └── Tabs
│
├── feedback/
│   ├── Toast
│   ├── Alert
│   ├── EmptyState
│   ├── ErrorState
│   └── LoadingState
│
├── overlay/
│   ├── Modal
│   ├── ConfirmModal
│   ├── Drawer
│   └── FilterDrawer
│
├── forms/
│   ├── TextInput
│   ├── Select
│   ├── Combobox
│   ├── Textarea
│   ├── Checkbox
│   ├── Radio
│   └── Switch
│
├── data-display/
│   ├── Card
│   ├── MetricCard
│   ├── Badge
│   ├── Table
│   └── Avatar
│
├── crm/
│   ├── Kanban
│   ├── KanbanColumn
│   ├── LeadCard
│   ├── LeadDetails
│   └── TemperatureBadge
│
├── messaging/
│   ├── TemplateCard
│   ├── TemplateEditor
│   ├── TemplateSelector
│   └── MessagePreview
│
├── dashboard/
│   ├── ConversionFunnel
│   ├── ProspectingChart
│   ├── GoalProgress
│   └── KPIGrid
│
└── credits/
    ├── CreditBalance
    ├── CreditProgress
    └── CreditWarning
```

---

# 86. Componentes Mantine Obrigatórios

Sempre que houver equivalente, utilizar componentes Mantine:

```text
AppShell
Button
ActionIcon
Badge
Card
Container
Drawer
Modal
Menu
Popover
Tooltip
Notification
Alert
TextInput
Textarea
Select
MultiSelect
Combobox
Checkbox
Radio
Switch
Tabs
Table
Pagination
Progress
Skeleton
Loader
Avatar
Divider
Breadcrumbs
ScrollArea
Paper
Stack
Group
Grid
Flex
```

---

# 87. Componentes Customizados

Criar componentes próprios somente quando o comportamento exigir especialização:

```text
LeadCard
KanbanBoard
KanbanColumn
CreditBalance
ConversionFunnel
GoalProgress
MessagePreview
TemplateVariablePicker
FilterDrawer
LeadTemperature
ScrapingProgress
```

A base visual desses componentes deve continuar utilizando Mantine.

---

# 88. Regra de Implementação

Não criar uma biblioteca visual paralela à Mantine.

A regra será:

```text
Mantine
   ↓
Theme
   ↓
Design Tokens
   ↓
Componentes reutilizáveis
   ↓
Páginas
```

Não criar estilos isolados diferentes para cada página.

---

# 89. Theme Mantine

O tema central deverá controlar:

```text
colors
primaryColor
fontFamily
headings
spacing
radius
shadows
breakpoints
components
```

A cor principal deverá ser configurada como:

```text
#15AABF
```

Todos os componentes devem consumir o tema em vez de possuir valores duplicados.

---

# 90. CSS Global

O CSS global deve:

- remover margens padrão;
- definir `box-sizing`;
- definir fonte;
- definir background;
- remover aparência padrão de botões;
- remover aparência padrão de inputs;
- configurar scrollbar;
- configurar seleção de texto;
- definir links;
- definir body;
- evitar overflow horizontal;
- garantir altura mínima da aplicação.

Nenhum componente deve depender do estilo padrão do browser.

---

# 91. Regra de Ouro Visual

A interface deve priorizar:

```text
Conteúdo > decoração

Hierarquia > efeitos

Clareza > densidade

Consistência > criatividade

Ação > ornamentação
```

---

# 92. Checklist de Implementação

Antes de considerar uma tela pronta:

- [ ] Utiliza Mantine
- [ ] Utiliza Lucide Icons
- [ ] Não possui emojis
- [ ] Não possui emoji como ícone
- [ ] Não possui `<select>` nativo
- [ ] Não possui botão nativo sem estilização
- [ ] Não depende de estilo padrão do navegador
- [ ] Possui estados de hover
- [ ] Possui estados de focus
- [ ] Possui estado disabled
- [ ] Possui loading quando necessário
- [ ] Possui estado vazio
- [ ] Possui tratamento de erro
- [ ] Scrollbar customizado
- [ ] Responsivo
- [ ] Sidebar retrátil
- [ ] Dropdowns customizados
- [ ] Modais customizados
- [ ] Drawers customizados
- [ ] Toast no canto superior direito
- [ ] Paginação padronizada
- [ ] Cores seguem os tokens
- [ ] Tipografia segue a escala
- [ ] Espaçamentos seguem a escala
- [ ] Ícones são outline
- [ ] Textos estão em português BR

---

# 93. Componentes Obrigatórios do MVP

A implementação final do Design System deve possuir, no mínimo:

### Layout

- AppShell
- Sidebar expandida/recolhida
- Mobile navigation
- Topbar
- User menu

### Navegação

- Breadcrumb
- Tabs
- Dropdown
- Menu contextual
- Pagination

### Feedback

- Toast
- Alert
- Empty state
- Error state
- Loading
- Skeleton

### Overlay

- Modal
- Confirmation modal
- Drawer
- Filter drawer

### Formulários

- Input
- Textarea
- Select
- MultiSelect
- Combobox
- Checkbox
- Radio
- Switch

### Dados

- Card
- Metric Card
- Badge
- Avatar
- Table
- Progress

### CRM

- Kanban
- Kanban Column
- Lead Card
- Temperature Badge
- Lead Details
- Schedule

### Mensagens

- Template Card
- Template Editor
- Variable Picker
- Message Preview
- WhatsApp Template Modal

### Dashboard

- KPI Cards
- Conversion Funnel
- Prospecting Chart
- Goal Progress

### Créditos

- Credit Balance
- Credit Progress
- Credit Warning
- Credit Exhausted State

---

# 94. Resultado Visual Esperado

O resultado final deve se aproximar de um SaaS moderno, profissional e limpo:

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                  ●  Avatar │
│         ├────────────────────────────────────────────────────┤
│         │                                                    │
│ Logo    │ Dashboard                                          │
│         │ Acompanhe o desempenho da sua operação.            │
│ Home    │                                                    │
│ Leads   │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│ CRM     │ │ 1.248   │ │ 18,4%   │ │ R$42,80 │ │ 236     │  │
│ Msg     │ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│ Metas   │                                                    │
│         │ ┌────────────────────┐ ┌────────────────────────┐ │
│ Config  │ │ Funil              │ │ Prospecção             │ │
│         │ │                    │ │                        │ │
│         │ │      gráfico       │ │       gráfico          │ │
│         │ │                    │ │                        │ │
│         │ └────────────────────┘ └────────────────────────┘ │
│         │                                                    │
└─────────┴────────────────────────────────────────────────────┘
```

A aparência deve ser predominantemente branca/cinza muito claro, com **#15AABF** utilizado como cor de ação e destaque. O sistema deve evitar a estética de "dashboard cheio de cards coloridos" e manter uma linguagem visual consistente de produto SaaS profissional.

---

# 95. Regra Final de Consistência

Nenhuma nova tela ou componente deverá ser criado fora deste sistema sem primeiro verificar:

1. Se o componente já existe no Design System.
2. Se existe um componente equivalente no Mantine.
3. Se o comportamento pode ser resolvido através de composição.
4. Se as cores estão utilizando os tokens.
5. Se a tipografia está utilizando os tokens.
6. Se os espaçamentos estão utilizando a escala.
7. Se o ícone pertence ao Lucide.
8. Se todos os estados foram definidos.
9. Se a interação funciona em desktop e mobile.
10. Se a solução mantém a mesma linguagem visual do restante do Orbixlead CRM.

**Objetivo:** qualquer página nova deve parecer parte do mesmo produto, independentemente de quem a implementou.