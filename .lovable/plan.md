

# Varredura do Painel de Entregadores

## Analise por pilar

### 1. Home (driver/Home.tsx) - 803 linhas
**Problemas encontrados:**
- **Arquivo muito grande** (803 linhas) - dificulta manutenção. Deveria ser dividido em componentes menores.
- **Canais Realtime duplicados**: `DriverQueueVisual` cria seus proprios canais para `drivers` e `deliveries`, enquanto `Home.tsx` ja escuta os mesmos. Isso gera queries duplicadas a cada mudanca.
- **Geocoding sem cache**: Toda vez que `activeDelivery` muda, faz chamadas ao Nominatim API. Se o entregador navega entre telas e volta, refaz as mesmas chamadas.
- **`as any` em delivery_offers**: Linhas 188-210 usam casts `as any` desnecessarios - o tipo ja existe no schema gerado.
- **Memory leak potencial**: `timerRef` no countdown do offer pode disparar apos componente desmontar se `currentOffer` mudar rapidamente.
- **`todayStats.earnings` mostra bruto**: O card diz "Ganho bruto" mas na verdade mostra o `delivery_fee` total sem descontar taxa. Inconsistente com a tela de Ganhos que mostra liquido.

### 2. Profile (driver/Profile.tsx)
- **Funcional e completo**: PIX, avatar, notificacoes, dados pessoais.
- **Sem erro critico**.
- **Otimizacao**: `loadData` faz 5 queries sequenciais (profiles, drivers, ratings, notifications, deliveries count). As 4 primeiras ja sao paralelas, mas a 5a (count) espera `driverRes` resolver. OK.

### 3. Earnings (driver/Earnings.tsx)
- **Calculo de semana incorreto**: Usa `getDay()` (domingo=0) para definir inicio da semana. Se hoje e domingo, `weekStart` = hoje, perdendo a semana inteira.
- **Sem skeleton para chart**: Mostra loading generico mas o chart pode piscar.
- **Funcional no geral**.

### 4. History (driver/History.tsx)
- **Carrega TODAS as entregas** sem limite. Se o entregador tiver centenas, fica lento.
- **Filtro feito no frontend** em vez de na query. Traz tudo do banco e filtra localmente.
- **Sem paginacao**.

### 5. Layout (DriverLayout.tsx)
- **3 queries iniciais sem loading visual** alem do header.
- **Sem cleanup adequado do realtime** alem do channel - OK, tem cleanup.
- **Funcional**.

### 6. BottomNav
- **Match exato de path**: `location.pathname === item.path` nao destaca sub-rotas. OK para as rotas atuais pois sao exatas.

### 7. ChatDialog
- **Funcional e bem implementado**.
- **ScrollArea nao usada**: Importa `ScrollArea` mas usa div com overflow manual.

---

## Plano de correcoes e otimizacoes

### Tarefa 1: Refatorar Home.tsx em componentes menores
Extrair 3 componentes:
- `ActiveDeliveryCard` (stepper + mapa + acoes)
- `QueueOfferCard` (oferta com timer)
- `PoolDeliveriesList` (lista pool)

Reduz Home.tsx de 803 para ~250 linhas. Melhora legibilidade e manutenibilidade.

### Tarefa 2: Eliminar canais Realtime duplicados
Remover os canais de `DriverQueueVisual` e fazer o componente receber `position`, `totalDrivers` e `searchingCount` como props do pai (Home.tsx), que ja escuta as mesmas tabelas.

### Tarefa 3: Otimizar History com filtro no backend + limite
Mover o filtro de periodo para a query Supabase (`.gte('delivered_at', dateFilter)`), adicionar `.limit(50)` e botao "Carregar mais".

### Tarefa 4: Remover `as any` casts desnecessarios
Os tipos de `delivery_offers` e `drivers.pix_key` ja existem no schema gerado. Limpar os casts.

### Tarefa 5: Corrigir calculo de semana no Earnings
Usar segunda-feira como inicio da semana (padrao BR) em vez de domingo.

### Tarefa 6: Pequenas melhorias de UX
- Adicionar `import { useCallback }` e memoizar handlers no Profile
- Remover import nao usado de `ScrollArea` no ChatDialog
- Garantir cleanup correto do timer no offer countdown

**Arquivos editados:**
- `src/pages/driver/Home.tsx`
- `src/pages/driver/History.tsx`
- `src/pages/driver/Earnings.tsx`
- `src/components/DriverQueueVisual.tsx`
- `src/components/ChatDialog.tsx`
- Novos: `src/components/driver/ActiveDeliveryCard.tsx`, `src/components/driver/QueueOfferCard.tsx`, `src/components/driver/PoolDeliveriesList.tsx`

