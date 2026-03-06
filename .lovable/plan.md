

# Plano: Revisão Geral e Estabilização do App

Analisei todo o código. Os dados de rede mostram que login, role e status retornam corretamente. Porém existem vários problemas de estabilidade e UX que causam comportamento "bugado".

## Problemas Identificados

### 1. Fetches duplicados no AuthContext (Performance)
Os logs de rede mostram 4 chamadas duplicadas para `user_roles` e `profiles` do mesmo usuário. O `getSession` e o `onAuthStateChange` disparam quase simultaneamente, e o guard `initialized.current` nem sempre previne isso porque o `then()` é assíncrono.

**Solução**: Registrar o listener `onAuthStateChange` ANTES de `getSession`, e usar o evento do listener como fonte única de verdade. Usar um flag `isMounted` para evitar updates após unmount.

### 2. `.single()` pode falhar silenciosamente
Em `EstablishmentFinancial`, `DriverEarnings`, `EstablishmentHistory`, `EstablishmentOrders`, `EstablishmentProfile` e `DriverProfile`, chamadas `.single()` sem tratamento de erro podem dar crash se o registro não existir.

**Solução**: Trocar por `.maybeSingle()` e tratar o caso de `data === null`.

### 3. Login não redireciona usuários já logados
Se o usuário já está logado e acessa `/login`, o formulário aparece normalmente ao invés de redirecionar para o painel correto.

**Solução**: Adicionar guard no Login e Register que redireciona para `/` se já autenticado.

### 4. PendingApproval acessível sem login
A página `/pending-approval` não verifica se o usuário está autenticado.

**Solução**: Redirecionar para `/login` se `!user`.

### 5. Warning "Function components cannot be given refs"
React Router v6 tenta passar refs para componentes funcionais. Isso gera warnings no console.

**Solução**: Este é um warning benigno do React Router v6 e não causa bugs. Ignorar.

### 6. Admin Cancellations usa update direto no banco
O componente `AdminCancellations` faz `supabase.from('deliveries').update(...)` diretamente, bypassing a edge function que tem lógica de notificações.

**Solução**: Usar `useDeliveryActions().cancelDelivery()` que invoca a edge function.

### 7. `app_settings` query pode falhar se não existir
`Settings`, `Financial` e `Earnings` buscam `platform_fee_percentage` com `.single()`, mas se a row não existir, dá erro.

**Solução**: Trocar por `.maybeSingle()`.

## Mudanças Planejadas

| Arquivo | Ação |
|---|---|
| `src/contexts/AuthContext.tsx` | Refatorar para eliminar fetches duplicados, usar listener como fonte única |
| `src/pages/Login.tsx` | Redirecionar se já autenticado |
| `src/pages/Register.tsx` | Redirecionar se já autenticado |
| `src/pages/PendingApproval.tsx` | Redirecionar se não autenticado |
| `src/pages/establishment/Orders.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/establishment/History.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/establishment/Financial.tsx` | `.single()` → `.maybeSingle()`, null check |
| `src/pages/establishment/Profile.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/driver/Earnings.tsx` | `.single()` → `.maybeSingle()`, null check |
| `src/pages/driver/Profile.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/driver/Home.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/admin/Settings.tsx` | `.single()` → `.maybeSingle()` |
| `src/pages/admin/Cancellations.tsx` | Usar edge function via `useDeliveryActions` |

## Detalhes Técnicos

**AuthContext refatorado**: O listener `onAuthStateChange` será a fonte primária. O `getSession` será usado apenas como fallback. Um `Set` de session IDs processados evitará fetches duplicados.

**Guards de redirecionamento**: Login e Register usarão `useAuth()` para checar `user` e `loading`, redirecionando para `/` se já logado. PendingApproval redirecionará para `/login` se `!user`.

**maybeSingle()**: Todas as queries que buscam um registro específico (perfil do driver, establishment, settings) serão trocadas para `.maybeSingle()` com fallback apropriado na UI.

