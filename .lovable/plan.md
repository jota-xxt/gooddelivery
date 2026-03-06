

# Plano: Turbinar as Páginas do Admin

As páginas do admin estão funcionais mas visualmente básicas — cards simples, sem gráficos, sem estados visuais ricos. Vamos elevar o nível visual e de UX de cada página.

## Mudanças por Página

### 1. Dashboard (`/admin`)
- Adicionar gráfico de entregas por dia (últimos 7 dias) usando Recharts (já instalado)
- Cards de métricas com ícones coloridos em backgrounds arredondados, variação percentual placeholder
- Lista de "Últimas Entregas" com status em tempo real (tabela compacta abaixo dos gráficos)
- Seção de "Entregas Ativas" mostrando entregas em andamento

### 2. Aprovações (`/admin/approvals`)
- Contador de pendências no topo (badge com número)
- Avatar placeholder com iniciais do nome do usuário
- Data de cadastro formatada
- Animação de saída ao aprovar/rejeitar (transição suave)
- Estado vazio com ilustração/ícone grande e texto descritivo

### 3. Usuários (`/admin/users`)
- Filtros por tipo (Todos / Entregadores / Estabelecimentos) com tabs
- Filtro por status (Todos / Aprovados / Suspensos / Pendentes)
- Avatar com iniciais do usuário
- Contadores por categoria no topo
- Layout em tabela no desktop, cards no mobile

### 4. Financeiro (`/admin/financial`)
- Já está razoável; melhorar os cards de resumo com ícones em backgrounds coloridos
- Adicionar gráfico de barras de receita semanal com Recharts

### 5. Cancelamentos (`/admin/cancellations`)
- Adicionar timestamp formatado de quando a entrega foi criada
- Indicador visual de urgência (tempo decorrido)
- Estado vazio mais elaborado com ícone

### 6. Configurações (`/admin/settings`)
- Melhorar layout com descrição da configuração
- Preview visual da taxa (slider + input)
- Seção de informações do sistema (versão, status)

## Arquivos a Editar

| Arquivo | Ação |
|---|---|
| `src/pages/admin/Dashboard.tsx` | Gráfico Recharts + últimas entregas + cards visuais |
| `src/pages/admin/Approvals.tsx` | Avatar, data, animação, empty state |
| `src/pages/admin/Users.tsx` | Tabs de filtro, avatar, contadores, layout responsivo |
| `src/pages/admin/Financial.tsx` | Gráfico de barras, cards visuais |
| `src/pages/admin/Cancellations.tsx` | Timestamp, urgência, empty state |
| `src/pages/admin/Settings.tsx` | Slider, descrição, layout melhorado |

## Detalhes Técnicos

- Recharts já está instalado — usar `BarChart`, `LineChart`, `ResponsiveContainer`
- Avatares com iniciais usando o componente `Avatar` do shadcn já disponível
- `date-fns` + `ptBR` já instalados para formatação de datas
- Manter todas as queries e lógica de negócio existentes, apenas melhorar a apresentação
- Skeleton loading states usando o componente `Skeleton` já existente

