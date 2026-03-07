

# Plano: Simplificar Formulário de Solicitação de Entrega

## Mudanças

### 1. Banco de Dados (Migration)
- Adicionar coluna `observations` (text, nullable) na tabela `deliveries`
- Adicionar coluna `urgency` (text, default 'normal') na tabela `deliveries` — valores: `normal`, `urgent`
- Tornar `customer_name` nullable com default vazio (manter coluna por compatibilidade com entregas existentes)
- Tornar `prep_time_minutes` nullable (não será mais obrigatório)

### 2. `src/pages/establishment/Orders.tsx`
- Remover campos: Nome do cliente, Tempo de preparo
- Adicionar campos:
  - **Observações** — textarea opcional (ex: "Entregar na portaria")
  - **Urgência** — select com "Normal" e "Urgente"
- Atualizar o insert para enviar `observations`, `urgency`, e valores default para `customer_name`

### 3. Exibição nos cards de pedido
- Mostrar badge de urgência ("Urgente" em vermelho) quando aplicável
- Mostrar observações no card quando preenchidas

