
## Turbinando o Painel do Estabelecimento

Concordo que está simples comparado ao painel do entregador. Vou propor uma reforma completa com visual mais rico e funcionalidades extras.

---

### Melhorias por Página

#### 1. **Pedidos (Orders.tsx)** - Página Principal
**Atual:** Lista simples de cards
**Proposta:**
- Header com saudação personalizada + resumo do dia (entregas ativas, tempo médio)
- Cards com **timeline visual expandida** mostrando onde está o entregador
- **Mini-mapa** em cada card mostrando a rota
- Animação de pulso para pedidos urgentes
- Filtros por status (tabs: Todos, Buscando, Em Andamento)
- Som/vibração ao receber atualização de status

#### 2. **Histórico (History.tsx)**
**Atual:** Lista minimalista sem detalhes
**Proposta:**
- **Filtros por data** (calendário) e status
- **Gráfico de linha** mostrando tendência de entregas por dia
- Cards expandíveis com **detalhes completos**: tempo total, nome do entregador, avaliação
- **Busca por endereço**
- Badge com tempo total da entrega
- Opção de **avaliar entregador** se ainda não avaliou

#### 3. **Financeiro (Financial.tsx)**
**Atual:** Cards simples + tabela
**Proposta:**
- **KPI cards** mais visuais: Total gasto, Ticket médio, Economia vs taxi
- **Gráfico de barras** comparando semanas
- **Gráfico de pizza** por entregador (quem mais entregou)
- Exportar relatório em **PDF/CSV**
- Indicador visual de tendência (↑ gastou mais que semana passada)

#### 4. **Perfil (Profile.tsx)** - Turbinada Completa
**Atual:** Campos estáticos + mapa
**Proposta:**
- **Header com avatar** e nome do negócio em destaque
- **Stats cards** igual driver: Total de pedidos, Avaliação média, Membro desde
- **Horário de funcionamento** editável
- **Preferências**: entregadores favoritos, valor padrão de corrida
- **Central de notificações** (últimas 5)
- Editar dados cadastrais inline
- **QR Code** para compartilhar link do estabelecimento

---

### Componentes Novos
- `EstablishmentHeader.tsx` - Header reutilizável com stats
- `DeliveryTracker.tsx` - Timeline visual do status da entrega
- `QuickStats.tsx` - Cards de KPI animados

### Estrutura Visual
```text
┌────────────────────────────────────────┐
│  🏪 Nome do Negócio                    │
│  ⭐ 4.8 (23 avaliações)                │
│  ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ 127 │ │ 4.8 │ │ Mai │              │
│  │Pedidos│ │Rating│ │/24 │              │
│  └─────┘ └─────┘ └─────┘              │
├────────────────────────────────────────┤
│  📦 Pedidos Ativos                     │
│  ┌────────────────────────────────┐   │
│  │ 🔴 Urgente · Buscando          │   │
│  │ Rua das Flores, 123            │   │
│  │ ●───○───○───○  15min           │   │
│  └────────────────────────────────┘   │
│  ┌────────────────────────────────┐   │
│  │ Entregador a caminho           │   │
│  │ João Silva · ⭐ 4.9            │   │
│  │ ●───●───○───○  8min            │   │
│  │ [Mini-mapa com rota]           │   │
│  └────────────────────────────────┘   │
└────────────────────────────────────────┘
           [ + FAB ]
```

---

### Resumo das Alterações
| Arquivo | Mudanças |
|---------|----------|
| `Orders.tsx` | Header com stats, tabs de filtro, cards com mini-mapa, avatar do entregador |
| `History.tsx` | Filtros, gráfico de tendência, cards expandíveis, avaliação |
| `Financial.tsx` | KPIs visuais, gráficos Recharts, export PDF/CSV |
| `Profile.tsx` | Avatar, stats grid, notificações, horário funcionamento |
| `EstablishmentLayout.tsx` | Opcional: header fixo com nome |
| `EstablishmentHeader.tsx` | Novo componente reutilizável |

---

### Priorização Sugerida
1. **Perfil** - Transformar igual ao do driver (mais impacto visual imediato)
2. **Pedidos** - Adicionar header + cards melhorados
3. **Histórico** - Filtros + gráfico
4. **Financeiro** - Gráficos Recharts
