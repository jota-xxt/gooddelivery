

## Turbinando o Painel Admin

O painel admin já tem uma base boa (Dashboard com gráficos, Aprovações, Usuários, Financeiro, Mapa, Configurações). Vou propor melhorias em cada página + funcionalidades novas.

---

### 1. Dashboard - Melhorias
**Atual:** 4 KPI cards + gráfico 7 dias + entregas ativas + tabela recentes
**Proposta:**
- **Auto-refresh** com Realtime (já tem no Mapa, falta no Dashboard)
- **Comparativo** com período anterior nos KPI cards (ex: "+12% vs semana passada")
- **Taxa de conclusão** como KPI extra (% entregas completadas vs canceladas)
- **Tempo médio de entrega** como métrica
- Indicador de **aprovações pendentes** com link direto

### 2. Aprovações - Melhorias
**Atual:** Lista simples com botões aprovar/rejeitar
**Proposta:**
- **Detalhes expandíveis**: ao clicar no card, mostrar dados completos (CPF/CNPJ, endereço, veículo do entregador)
- **Aprovar/Rejeitar em lote** (checkbox + ação em massa)
- **Filtro por tipo** (Entregador vs Estabelecimento)
- **Contadores** por tipo no topo
- **Confirmação** antes de rejeitar (AlertDialog)

### 3. Usuários - Melhorias
**Atual:** Lista com filtros por role/status + suspender
**Proposta:**
- **Drawer de detalhes** ao clicar no usuário: ver entregas, avaliações, dados completos
- **Avatar real** do usuário (já tem avatar_url no profiles)
- **Último acesso / entrega** como informação extra
- **Ordenação** por nome, data de cadastro, total de entregas
- **Ação de editar** dados (nome, telefone) pelo admin

### 4. Financeiro - Melhorias
**Atual:** KPIs + gráfico semanal + tabelas por tipo
**Proposta:**
- **Gráfico de pizza** mostrando split receita: plataforma vs entregadores vs estabelecimentos
- **Comparativo mensal** além do semanal
- **Filtro por entidade** específica (buscar por nome)
- **Indicador de pagamentos pendentes** em destaque

### 5. Mapa - Melhorias
**Atual:** Mapa com marcadores + lista de entregas ativas
**Proposta:**
- **Filtro por status** no mapa (toggle: buscando, coletando, entregando)
- **Clique no marcador** mostra detalhes da entrega em mini-card

### 6. Nova Página: Entregas (Gerenciamento)
**Atualmente não existe** uma página dedicada para o admin ver/gerenciar TODAS as entregas.
**Proposta:**
- Tabela completa de entregas com **busca, filtros por status/data/estabelecimento**
- **Detalhes expandíveis** com timeline completa (criada, aceita, coletada, entregue)
- Ação de **cancelar entrega** pelo admin
- **Exportar CSV**

---

### Priorização (ordem de implementação)
1. **Nova página Entregas** (maior gap funcional - admin não consegue ver todas as entregas)
2. **Aprovações** melhoradas (batch + detalhes + confirmação)
3. **Dashboard** com Realtime + métricas extras
4. **Usuários** com drawer de detalhes + avatar
5. **Financeiro** com gráfico de pizza
6. **Mapa** com filtros

### Arquivos Alterados
| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/Deliveries.tsx` | Nova página de gerenciamento de entregas |
| `src/pages/admin/Approvals.tsx` | Batch actions, detalhes expandíveis, filtro por tipo, AlertDialog |
| `src/pages/admin/Dashboard.tsx` | Realtime, métricas extras, comparativo, link para aprovações |
| `src/pages/admin/Users.tsx` | Drawer de detalhes, avatar real, ordenação |
| `src/pages/admin/Financial.tsx` | PieChart, filtro por entidade |
| `src/pages/admin/MapOverview.tsx` | Filtros por status |
| `src/components/AdminSidebar.tsx` | Adicionar link "Entregas" na navegação |
| `src/App.tsx` | Rota `/admin/deliveries` |

