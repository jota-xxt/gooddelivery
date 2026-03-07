

# Remover página de Cancelamentos

Remoção completa da funcionalidade de cancelamentos do painel admin.

## Alterações

1. **Deletar** `src/pages/admin/Cancellations.tsx`
2. **`src/App.tsx`** — remover import e rota `/admin/cancellations`
3. **`src/components/AdminSidebar.tsx`** — remover item "Cancelamentos" do array `navItems`

Nenhuma alteração no banco de dados é necessária — o `cancel_reason` e `cancelled_at` nas entregas continuam disponíveis caso sejam usados em outros contextos (ex: edge function `update-delivery-status`).

