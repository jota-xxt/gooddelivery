

# 🚚 Good Delivery — Plataforma de Entregas

## Visão Geral
Plataforma que conecta **entregadores** a **estabelecimentos** da cidade. O estabelecimento solicita um entregador, o pedido vai para o pool, o entregador aceita e executa a entrega. Admin gerencia tudo.

**Design**: Mobile-first, paleta vermelha (#ea2a33), fundo claro (#f8f6f6), fonte Plus Jakarta Sans — baseado nos mockups fornecidos.

**Backend**: Lovable Cloud (Supabase) com tempo real via Realtime subscriptions.

---

## 1. Autenticação & Cadastro

- **Página de login** unificada (email + senha)
- **Cadastro com formulários distintos**:
  - **Entregador**: Nome, CPF, telefone, veículo (moto/bicicleta/carro), placa
  - **Estabelecimento**: Nome do negócio, CNPJ, endereço, telefone, responsável
- Após cadastro, status fica **"Pendente Aprovação"** — só acessa o painel após aprovação do admin
- Tela de "Aguardando aprovação" para quem ainda não foi aprovado

## 2. Painel do Estabelecimento

- **Solicitar Entrega**: Formulário com nome do cliente, endereço de entrega, tempo estimado de preparo (15/30/45 min), valor da corrida (definido pelo estabelecimento)
- **Pedidos Pendentes**: Lista de entregas ativas com status em tempo real (buscando entregador → aceito → coletando → entregando → concluído)
- **Histórico de Entregas**: Entregas passadas com filtros por data, valores e status
- **Avaliação**: Avaliar entregador após conclusão (estrelas + comentário opcional)
- **Financeiro**: Resumo semanal de entregas realizadas e valor total a pagar
- **Bottom nav**: Pedidos | Histórico | Perfil

## 3. Painel do Entregador

- **Toggle Online/Offline**: Controla disponibilidade para receber corridas
- **Nova Corrida (Pool)**: Notificação em tempo real com card mostrando valor, distância, endereços de coleta e entrega — botões Aceitar/Recusar (igual ao mockup)
- **Corrida Ativa**: Fluxo de etapas com botões de ação:
  - Aceito → "Cheguei no estabelecimento"
  - Coletando → "Saí para entrega"  
  - Entregando → "Entrega concluída"
- **Navegação**: Botão para abrir rota no Google Maps/Waze
- **Ganhos**: Resumo diário/semanal/mensal com detalhamento por corrida
- **Avaliação**: Avaliar estabelecimento após entrega
- **Bottom nav**: Início | Ganhos | Perfil

## 4. Painel Admin

- **Dashboard**: Métricas em cards — total de entregas (hoje/semana/mês), faturamento, entregadores online, estabelecimentos ativos
- **Aprovar Cadastros**: Fila de entregadores e estabelecimentos pendentes, com botões aprovar/rejeitar
- **Gerenciar Usuários**: Lista de todos os usuários com busca, filtro por tipo, ações (suspender, reativar, editar)
- **Configurar Taxa**: Definir % de taxa da plataforma sobre cada corrida
- **Financeiro**: Relatório semanal — quanto cada estabelecimento deve, quanto repassar a cada entregador (receita da corrida - taxa do app)
- **Cancelamentos**: Gerenciar solicitações de cancelamento (só admin pode cancelar)
- **Sidebar navigation** (layout desktop)

## 5. Sistema de Pedidos & Pool

- Estabelecimento cria pedido → status "Buscando entregador"
- Pedido aparece para **todos entregadores online** (pool aberto)
- Primeiro a aceitar leva a corrida
- Se ninguém aceitar em X minutos, notifica o estabelecimento
- Fluxo: Buscando → Aceito → Coletando → Em entrega → Concluído
- Cancelamento: apenas via admin

## 6. Sistema Financeiro

- Estabelecimento define valor da corrida ao solicitar
- Taxa do app (% configurável pelo admin) é descontada
- Entregador recebe: valor da corrida - taxa do app
- Relatório semanal automático para admin com:
  - Quanto cada estabelecimento deve pagar
  - Quanto repassar a cada entregador
- Histórico financeiro para todos os perfis

## 7. Notificações em Tempo Real

- **No app**: Notificações visuais + sonoras para novas corridas (entregador), mudanças de status (estabelecimento), novos cadastros (admin)
- **WhatsApp** (via Edge Function): Mensagens automáticas entre estabelecimento, entregador e admin para eventos importantes (nova corrida, aceite, conclusão)

## 8. Avaliações Mútuas

- Após cada entrega, estabelecimento avalia entregador (1-5 estrelas)
- Entregador avalia estabelecimento (1-5 estrelas)
- Média visível no perfil de cada um
- Admin pode ver todas as avaliações

## 9. Banco de Dados (Supabase)

- **profiles**: dados do usuário (nome, telefone, tipo)
- **user_roles**: roles separadas (admin, entregador, estabelecimento) — segurança RLS
- **establishments**: dados do negócio (CNPJ, endereço)
- **drivers**: dados do entregador (veículo, placa, online/offline)
- **deliveries**: pedidos de entrega com todo o fluxo de status
- **ratings**: avaliações mútuas
- **financial_reports**: relatórios semanais
- **notifications**: notificações internas
- RLS em todas as tabelas com função `has_role()` para segurança

## 10. Design & UX

- **Mobile-first** responsivo
- Paleta: vermelho primário (#ea2a33), fundo claro (#f8f6f6), cards brancos
- Fonte: Plus Jakarta Sans
- Bottom navigation para entregador e estabelecimento
- Sidebar para admin (desktop)
- Ícones Lucide React
- Animações suaves em transições de status
- Sons de notificação para novas corridas

