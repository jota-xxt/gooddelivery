

# Plano: Implementar 4 Melhorias no Sistema de Distribuição

## A) Corrigir notificações usando `delivery_address` em vez de `customer_name`

**Arquivo:** `supabase/functions/update-delivery-status/index.ts`

Substituir todas as referências a `delivery.customer_name` por `delivery.delivery_address` nas mensagens de notificação (funções `handleAccept`, `handleAdvance`, `handleCancel`). Exemplo: *"O entregador aceitou a corrida para Rua das Flores, 123."*

---

## B) Reprocessar fila quando oferta expira por timeout no frontend

**Arquivo:** `src/pages/driver/Home.tsx`

No `useEffect` do timer (linha ~156), quando `remaining === 0`, além de limpar o estado local, chamar `supabase.functions.invoke('process-delivery-queue', { body: { delivery_id: currentOffer.delivery_id } })` para que o backend expire a oferta e ofereça ao próximo entregador.

---

## C) Sincronizar modo de distribuição em tempo real

**Arquivo:** `src/pages/driver/Home.tsx`

Adicionar um canal Realtime ouvindo mudanças na tabela `app_settings`. Quando o valor de `delivery_mode` mudar, atualizar o state `deliveryMode` automaticamente sem precisar de refresh.

**Migration:** Habilitar Realtime para `app_settings`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
```

---

## D) pg_cron como backup de resiliência

**Migration:** Habilitar extensões `pg_cron` e `pg_net`:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

**SQL (insert tool, não migration):** Criar cron job que roda a cada minuto, chamando `process-delivery-queue` para cada delivery em `searching` que tenha ofertas pendentes expiradas (>60s) ou nenhuma oferta ativa. Isso garante que nenhuma corrida fique travada mesmo que o frontend falhe.

**Edge Function:** Criar `expire-stale-offers/index.ts` que:
1. Marca como `expired` todas as ofertas `pending` com mais de 60s
2. Para cada delivery `searching` sem oferta ativa, chama `process-delivery-queue`

O cron job invoca essa nova função a cada minuto.

---

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/update-delivery-status/index.ts` | Trocar `customer_name` → `delivery_address` nas notificações |
| `src/pages/driver/Home.tsx` | Chamar reprocessamento no timeout + listener Realtime de `app_settings` |
| `supabase/functions/expire-stale-offers/index.ts` | Nova função para expirar ofertas e reprocessar fila |
| Migration SQL | Habilitar Realtime em `app_settings`, habilitar `pg_cron` e `pg_net` |
| Insert SQL | Criar cron job chamando `expire-stale-offers` a cada minuto |

