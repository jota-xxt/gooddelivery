

# Plano: Sistema de Punição para Modo Fila

## Conceito

Quando um entregador no modo fila **rejeita** ou **perde por timeout** uma oferta, isso conta como uma "infração". Ao acumular X infrações dentro de uma janela de tempo, o entregador é **bloqueado temporariamente** — fica impedido de receber novas ofertas por Y minutos.

Os valores de X (limite de infrações) e Y (tempo de bloqueio) serão configuráveis pelo admin na tela de Configurações.

---

## Implementação

### 1. Novas configurações no banco (`app_settings`)

Inserir 2 novas linhas via insert tool:
- `queue_penalty_threshold` = `3` (número de rejeições/expiradas para bloquear)
- `queue_penalty_duration_minutes` = `30` (duração do bloqueio em minutos)

### 2. Nova coluna na tabela `drivers`

Migration para adicionar:
```sql
ALTER TABLE public.drivers 
  ADD COLUMN blocked_until timestamptz DEFAULT NULL;
```

Quando o entregador acumular infrações suficientes, `blocked_until` é setado para `now() + duração`. A fila ignora entregadores com `blocked_until > now()`.

### 3. Edge Function `process-delivery-queue` — filtrar bloqueados

Ao selecionar o próximo entregador, adicionar verificação: pular drivers onde `blocked_until` não é nulo e é maior que `now()`.

### 4. Edge Function `update-delivery-status` — aplicar punição

Nas ações `reject` e no timeout (oferta expirada), após registrar a rejeição/expiração:
1. Contar ofertas com status `rejected` ou `expired` desse driver nas últimas 24h
2. Se >= threshold, setar `blocked_until = now() + duração` no driver
3. Notificar o driver sobre o bloqueio

### 5. Edge Function `expire-stale-offers` — aplicar punição no backup

Quando a função de backup expira ofertas, também aplicar a mesma lógica de contagem e bloqueio.

### 6. Frontend do entregador (`Home.tsx`)

- Verificar `blocked_until` ao carregar e exibir mensagem de bloqueio com countdown
- Impedir de receber ofertas enquanto bloqueado

### 7. Tela de configurações do admin (`Settings.tsx`)

Adicionar controles para:
- **Limite de infrações** (slider, 1-10, default 3)
- **Tempo de bloqueio** (slider, 5-120 min, default 30)

---

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar `blocked_until` em `drivers` |
| Insert SQL | Criar settings `queue_penalty_threshold` e `queue_penalty_duration_minutes` |
| `supabase/functions/process-delivery-queue/index.ts` | Filtrar drivers bloqueados |
| `supabase/functions/update-delivery-status/index.ts` | Contar infrações e aplicar bloqueio no reject |
| `supabase/functions/expire-stale-offers/index.ts` | Aplicar bloqueio ao expirar ofertas |
| `src/pages/driver/Home.tsx` | Exibir estado de bloqueio com countdown |
| `src/pages/admin/Settings.tsx` | Controles de threshold e duração do bloqueio |

