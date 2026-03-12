

# Varredura Completa — Good Delivery

Analise dividida em 3 paineis com problemas encontrados e otimizacoes propostas.

---

## PAINEL ADMIN

### Bugs

**A1. Warning de ref no UserCard** (console error ativo)
- `UserCard.tsx` passa ref para `Badge` e `DropdownMenu` sem `forwardRef`. Warnings aparecem no console agora.
- **Fix**: Envolver `UserCard` em `React.forwardRef` ou remover refs implicitos.

**A2. Codigo morto no MapOverview**
- `markers` (linha 168-175) e calculado mas nunca usado — `filteredMarkers` e o que realmente e passado ao mapa. Variavel `markers` pode ser removida.

**A3. Dashboard refetch excessivo via Realtime**
- O canal `admin-dashboard-rt` escuta `deliveries` e `profiles` e chama `fetchAll()` completo a cada mudanca. Uma unica mudanca em qualquer profile (ex: avatar upload) dispara recalculo de todas as metricas + re-fetch de 6 queries.
- **Fix**: Debounce de 2s no `fetchAll` para evitar multiplas execucoes em rajada.

**A4. Admin Deliveries sem paginacao**
- `fetchDeliveries` carrega ate 500 entregas de uma vez. Conforme o volume cresce, isso vai degradar.
- **Fix**: Implementar paginacao ou scroll infinito.

**A5. Financial.tsx — arquivo de 781 linhas**
- Componente monolitico dificil de manter. Dividir em sub-componentes (KPIs, Charts, EntityTable).

### Otimizacoes

**A6. AdminSidebar — icone duplicado**
- `Aprovacoes` e `Usuarios` usam o mesmo icone `Users`. Trocar `Aprovacoes` para `UserCheck`.

**A7. Admin Deliveries — realtime refaz toda a query**
- Mesmo problema do Dashboard: qualquer change em `deliveries` recarrega tudo.
- **Fix**: Debounce.

---

## PAINEL ENTREGADOR

### Bugs

**B1. QuickStats grid-cols dinamico nao funciona com Tailwind**
- `grid-cols-${Math.min(stats.length, 4)}` — Tailwind nao gera classes dinamicas. O grid pode nao funcionar quando `stats.length !== 4`.
- **Fix**: Usar classes fixas ou safelist. Para 3 stats, `grid-cols-3`; para 4, `grid-cols-4`. Melhor: sempre `grid-cols-2 sm:grid-cols-4` ou usar mapa de classes.

**B2. Profile.tsx — falta `user` no dependency array de loadData**
- `useEffect` depende de `user` mas `loadData` usa `user!.id` diretamente — se `user` mudar entre renders, pode dar problema. Baixa probabilidade mas facil de corrigir.

**B3. Earnings.tsx — weekStart nao usa startOfWeek**
- Calculo manual de segunda-feira com `setDate` — funciona mas e fragil. Ja existe `startOfWeek` de `date-fns` importado no Profile mas nao usado no Earnings.
- **Fix**: Usar `startOfWeek(now, { weekStartsOn: 1 })` consistentemente.

**B4. Home.tsx — geocodeAddress sem tratamento de rate limit**
- Se geocoding falhar silenciosamente (`catch {}`), o mapa fica sem marcadores sem feedback ao usuario.
- **Fix**: Adicionar fallback ou mensagem.

### Otimizacoes

**B5. History.tsx — nao tem loading skeleton**
- Usa `Skeleton` apenas com 3 blocos genericos. Poderia ter skeleton cards parecidos com os reais.

**B6. Earnings.tsx — nao reage a mudancas em tempo real**
- Diferente do Dashboard e Home que tem Realtime, a pagina de ganhos so carrega uma vez. Se o driver completar uma entrega e voltar para Earnings, os dados estarao desatualizados ate reload.
- **Fix**: Adicionar canal Realtime ou `refetchOnWindowFocus` via React Query.

**B7. Profile — muitas queries sequenciais**
- `loadData` faz 4 queries paralelas seguidas de 3 queries sequenciais (total, offers, weekly). Poderia paralelizar tudo com um unico `Promise.all`.

---

## PAINEL ESTABELECIMENTO

### Bugs

**C1. Orders.tsx — `animate-pulse-subtle` nao existe**
- Classe `animate-pulse-subtle` (linha 237) nao e definida no Tailwind config nem no CSS. Cards com status `searching` nao pulsam.
- **Fix**: Adicionar keyframe em `tailwind.config.ts` ou usar `animate-pulse`.

**C2. Financial.tsx — weekStart calculo errado**
- Linha 100: `weekStart.setDate(weekStart.getDate() - weekStart.getDay())` usa domingo como inicio. Inconsistente com o resto do app que usa segunda-feira.
- **Fix**: Usar `startOfWeek(now, { weekStartsOn: 1 })`.

**C3. History.tsx — sem paginacao**
- Carrega todas as entregas do periodo sem `.limit()`. Com 30 dias de dados, pode ficar pesado.
- **Fix**: Adicionar `.limit(50)` com "Carregar mais".

**C4. Profile.tsx — `as any` em multiplos lugares**
- Linhas 67, 89, 95: usa `as any` para tipar dados do Supabase. Indica tipagem incompleta.

### Otimizacoes

**C5. Orders.tsx — stats de hoje nao tem Realtime**
- `todayStats` depende de `deliveries` como dep, mas `deliveries` so mostra ativas. Entregas completadas/canceladas saem da lista e os stats nao atualizam.
- **Fix**: Buscar stats independentemente via Realtime ou refetch.

**C6. Profile.tsx — mapa Leaflet carrega mesmo se nao visivel**
- O mini-mapa de localizacao renderiza sempre. Se a maioria dos estabelecimentos nao definiu localizacao, carrega Leaflet a toa.
- **Fix**: Lazy load do MapPicker com `React.lazy` ou renderizar so se `hasLocation`.

---

## CROSS-CUTTING (afeta todos)

### Bugs

**X1. QuickStats grid-cols dinamico** (ja mencionado em B1)
- Afeta Establishment Orders (3 stats), Driver Profile (4 stats), Establishment Profile (3 stats). O Tailwind JIT nao gera `grid-cols-3` dinamicamente.

**X2. Sem "Esqueci minha senha" no Login**
- Login.tsx nao tem link para recuperacao de senha. Usuarios travados nao conseguem resetar.

**X3. Sem feedback de loading no botao de logout**
- `signOut` e async mas o botao nao desabilita durante o processo.

### Otimizacoes

**X4. Duplicacao de logica driver name resolution**
- O padrao `drivers.select(id, user_id) → profiles.select(user_id, full_name)` se repete em 8+ arquivos. Criar um hook `useDriverNames(driverIds)` ou uma database view `driver_profiles`.

**X5. Sem Error Boundaries**
- Um erro em qualquer componente quebra o app inteiro. Adicionar ErrorBoundary ao redor de cada layout.

---

## Plano de Implementacao (priorizado)

### Fase 1 — Bugs criticos (5 fixes)
1. **Fix QuickStats** — usar mapa de classes `{2:'grid-cols-2', 3:'grid-cols-3', 4:'grid-cols-4'}`
2. **Fix `animate-pulse-subtle`** — adicionar ao tailwind.config.ts
3. **Fix weekStart inconsistente** — usar `startOfWeek(now, {weekStartsOn:1})` em EstablishmentFinancial
4. **Fix UserCard ref warning** — adicionar `forwardRef` ou remover refs implicitos
5. **Remover codigo morto** no MapOverview (`markers` variavel nao usada)

### Fase 2 — Otimizacoes de UX (4 fixes)
6. **Adicionar "Esqueci minha senha"** no Login.tsx
7. **Debounce nos Realtime handlers** do Dashboard e Deliveries admin
8. **Adicionar paginacao** no EstablishmentHistory (limit + carregar mais)
9. **Paralelizar queries** no driver Profile loadData

### Fase 3 — Arquitetura (3 fixes)
10. **Criar hook `useDriverNames`** para eliminar duplicacao em 8 arquivos
11. **Adicionar ErrorBoundary** nos 3 layouts
12. **AdminSidebar** — icone diferenciado para Aprovacoes

### Arquivos a editar
- `src/components/QuickStats.tsx`
- `tailwind.config.ts`
- `src/pages/establishment/Financial.tsx`
- `src/components/admin/UserCard.tsx`
- `src/pages/admin/MapOverview.tsx`
- `src/pages/Login.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/Deliveries.tsx`
- `src/pages/establishment/History.tsx`
- `src/pages/driver/Profile.tsx`
- `src/hooks/useDriverNames.ts` (novo)
- `src/components/ErrorBoundary.tsx` (novo)
- `src/layouts/AdminLayout.tsx`
- `src/layouts/DriverLayout.tsx`
- `src/layouts/EstablishmentLayout.tsx`
- `src/components/AdminSidebar.tsx`

