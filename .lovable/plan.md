

# Plano: Revisao Geral e Correção de Bugs

## Bugs Identificados

### 1. UUID inválido `'x'` causa erro 400
Em `driver/Earnings.tsx`, `admin/Financial.tsx` e `establishment/Financial.tsx`, quando não há IDs para buscar, o código usa `.in('id', ['x'])` como fallback, gerando erro `invalid input syntax for type uuid: "x"` (visível nos logs de rede). **Solução**: Verificar se o array está vazio antes de fazer a query.

### 2. Edge Function `update-delivery-status` — body consumido duas vezes
Na ação `cancel` (linha 189), o código tenta fazer `await req.json()` de novo, mas o body já foi consumido na linha 38. O `cancel_reason` nunca é lido. **Solução**: Extrair `cancel_reason` junto com `delivery_id` e `action` na primeira leitura do body.

### 3. Queries N+1 nas páginas Admin
`admin/Approvals.tsx` e `admin/Users.tsx` buscam roles um por um num loop `for`. **Solução**: Buscar todos os roles de uma vez com `.in('user_id', userIds)`.

### 4. Driver Profile ainda referencia `plate`
O campo placa foi removido do cadastro mas o perfil ainda mostra `driver.plate`. **Solução**: Remover referência a `plate`.

### 5. Admin sem navegação mobile
O `AdminSidebar` usa `hidden lg:flex`, sem alternativa mobile. **Solução**: Adicionar header mobile com menu hamburguer ou drawer.

### 6. Rotas não protegidas por role
`/admin/*`, `/driver/*` e `/establishment/*` não verificam se o usuário tem o role correto. Um driver pode acessar `/admin` diretamente. **Solução**: Criar componente `RoleGuard` que redireciona se o role não bater.

### 7. AuthContext — loading não reseta em mudanças subsequentes
Quando o listener `onAuthStateChange` dispara (ex: token refresh), `fetchUserMeta` roda fire-and-forget mas o `loading` não reflete. Pode causar flicker. **Solução**: Manter o padrão atual mas garantir que o estado seja consistente.

## Mudanças Planejadas

| Arquivo | Ação |
|---|---|
| `src/contexts/AuthContext.tsx` | Refatorar para padrão robusto com getSession + listener sem await |
| `src/App.tsx` | Adicionar `RoleGuard` wrapper nas rotas protegidas |
| `src/components/RoleGuard.tsx` | Novo componente que verifica role e redireciona |
| `src/components/AdminSidebar.tsx` | Adicionar menu mobile (sheet/drawer) |
| `src/layouts/AdminLayout.tsx` | Integrar mobile nav |
| `src/pages/admin/Users.tsx` | Corrigir N+1, remover warning de ref no Badge |
| `src/pages/admin/Approvals.tsx` | Corrigir N+1 |
| `src/pages/admin/Financial.tsx` | Corrigir fallback UUID `'x'` |
| `src/pages/driver/Earnings.tsx` | Corrigir fallback UUID `'x'` |
| `src/pages/driver/Profile.tsx` | Remover referência a `plate` |
| `src/pages/establishment/Financial.tsx` | Corrigir fallback UUID |
| `supabase/functions/update-delivery-status/index.ts` | Corrigir body consumido duas vezes no cancel |

## Detalhes Técnicos

- **RoleGuard**: Componente que recebe `allowedRoles` e usa `useAuth()` para verificar. Se `loading`, mostra spinner. Se role errado, redireciona para `/`.
- **Admin Mobile Nav**: Usar `Sheet` do Radix para abrir sidebar como drawer no mobile, com botão hamburguer fixo no topo.
- **UUID fix**: Substituir `['x']` por verificação `if (ids.length === 0) return;` ou skip da query.
- **Edge function fix**: Desestruturar `cancel_reason` junto com `delivery_id` e `action` na mesma chamada `req.json()`.

