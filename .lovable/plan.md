

# Plano: Sistema de Filas para Distribuição de Entregas

## Conceito

Atualmente o sistema usa **pool aberto** (todos os entregadores online veem todas as corridas). O novo sistema de **fila** distribui corridas automaticamente para o próximo entregador da fila, um por vez. O admin alterna entre os dois modos nas Configurações.

## Como Funciona a Fila

1. Entregador fica online → entra no final da fila (registra `queue_joined_at`)
2. Novo pedido chega → sistema oferece automaticamente ao primeiro da fila
3. Entregador aceita → sai da fila, entrega é atribuída
4. Entregador conclui entrega → volta ao final da fila automaticamente
5. Se entregador rejeita ou timeout (60s) → oferece ao próximo da fila

## Mudanças no Banco de Dados

**Migration:**
- Adicionar coluna `queue_joined_at` (timestamp) na tabela `drivers`
- Inserir nova configuração `delivery_mode` = `pool` na tabela `app_settings`
- Adicionar tabela `delivery_offers` para rastrear ofertas na fila (delivery_id, driver_id, offered_at, status: pending/accepted/rejected/expired)

## Mudanças por Arquivo

### 1. Edge Function `update-delivery-status/index.ts`
- Na action `accept`: verificar o modo ativo. Se fila, validar que a oferta existe para aquele driver
- Nova action `reject`: driver rejeita oferta, sistema oferece ao próximo
- Nova action `offer_next`: lógica interna para encontrar próximo driver na fila e criar oferta

### 2. Nova Edge Function `process-delivery-queue/index.ts`
- Chamada quando um pedido é criado (ou quando uma oferta expira)
- Busca o modo de distribuição em `app_settings`
- Se `queue`: encontra o driver online com `queue_joined_at` mais antigo sem entrega ativa, cria oferta em `delivery_offers`
- Se `pool`: não faz nada (comportamento atual)

### 3. `src/pages/driver/Home.tsx`
- Buscar `delivery_mode` do `app_settings`
- Se modo **fila**: mostrar posição na fila ("Você é o #3 da fila") em vez do pool de corridas
- Mostrar oferta recebida com timer de 60s para aceitar/rejeitar
- Se modo **pool**: comportamento atual mantido

### 4. `src/pages/admin/Settings.tsx`
- Novo card "Modo de Distribuição" com switch/toggle entre Pool Aberto e Fila
- Descrição explicativa de cada modo
- Indicador visual do modo ativo

### 5. `src/pages/establishment/Orders.tsx`
- Após criar pedido, invocar `process-delivery-queue` para iniciar distribuição se modo fila

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `queue_joined_at`, `delivery_offers` table, setting `delivery_mode` |
| `supabase/functions/process-delivery-queue/index.ts` | Nova edge function para processar fila |
| `supabase/functions/update-delivery-status/index.ts` | Adicionar actions `reject`, validação de oferta |
| `src/pages/driver/Home.tsx` | UI de posição na fila + oferta com timer |
| `src/pages/admin/Settings.tsx` | Toggle de modo de distribuição |
| `src/pages/establishment/Orders.tsx` | Invocar fila após criar pedido |

## Detalhes Técnicos

- `delivery_offers` com RLS: drivers veem ofertas próprias, admins veem todas
- Realtime habilitado em `delivery_offers` para notificar driver instantaneamente
- `queue_joined_at` atualizado ao ficar online e ao concluir entrega (volta ao final)
- Timer de 60s no frontend; expiração verificada na edge function antes de oferecer ao próximo

