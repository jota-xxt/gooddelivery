

# Plano: Turbinar o Painel dos Entregadores

Transformar as 3 páginas do entregador em uma experiência de app profissional, estilo iFood/99/Uber.

## Mudanças por Página

### 1. Layout (`DriverLayout.tsx`)
- Header fixo com saudação ("Olá, João"), avatar com iniciais e notificação bell icon
- BottomNav com 4 itens: Início, Histórico (novo), Ganhos, Perfil
- Indicador de status online/offline no header (dot verde/cinza)

### 2. Home (`/driver`) - Tela Principal
- Header hero com gradiente primário mostrando status online/offline com toggle grande e animação pulse quando online
- Cards de resumo rápido: entregas do dia + ganho do dia (inline, compactos)
- Entrega ativa: card fullwidth com stepper visual melhorado (ícones por etapa: Store, Package, MapPin), timer mostrando tempo decorrido desde aceite, botões de ação maiores com cores contextuais
- Pool de corridas: cards com layout tipo ride-hailing (linha visual conectando coleta→entrega com dots e linha tracejada), valor em destaque grande, botão aceitar com gradiente
- Estado vazio quando offline: ilustração com ícone grande de Power + texto motivacional
- Estado vazio online sem corridas: animação de radar/pulse buscando corridas

### 3. Histórico (NOVA página `/driver/history`)
- Extrair a listagem de entregas concluídas do Earnings para cá
- Lista de entregas com cards (não tabela - melhor para mobile)
- Cada card: data, estabelecimento, cliente, valor líquido, badge de status
- Filtro por período (Hoje/Semana/Mês/Tudo)
- Estado vazio com ícone

### 4. Ganhos (`/driver/earnings`) - Foco em Resumo Financeiro
- Cards de resumo com ícones em backgrounds coloridos (como fizemos no admin)
- Gráfico de barras com ganhos dos últimos 7 dias usando Recharts
- Relatórios semanais com visual melhorado (progress bar para status de pagamento)
- Remover tabela de entregas (movida para Histórico)

### 5. Perfil (`/driver/profile`)
- Avatar grande com iniciais no topo (circular, com background primário)
- Rating com estrelas visuais (não apenas número)
- Informações em seções com ícones (Dados Pessoais, Veículo)
- Card de estatísticas: total de entregas, membro desde, avaliação média
- Botão sair como destructive no final
- Seção de notificações recentes (últimas 5)

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| `src/layouts/DriverLayout.tsx` | Header com avatar + saudação, 4 tabs no BottomNav |
| `src/pages/driver/Home.tsx` | Hero status, resumo do dia, pool e entrega ativa melhorados |
| `src/pages/driver/History.tsx` | Nova página de histórico de entregas |
| `src/pages/driver/Earnings.tsx` | Gráfico Recharts, cards visuais, sem tabela |
| `src/pages/driver/Profile.tsx` | Avatar, stats, notificações, seções com ícones |
| `src/App.tsx` | Adicionar rota `/driver/history` |

## Detalhes Técnicos

- Recharts (`BarChart`, `ResponsiveContainer`) para gráfico de ganhos - já instalado
- `date-fns` + `ptBR` para formatação - já instalado
- Avatar do shadcn para iniciais do nome
- Todas as queries existentes mantidas, apenas reorganizadas entre páginas
- Notificações do driver lidas da tabela `notifications` existente
- Realtime no pool de entregas já funciona, será mantido

