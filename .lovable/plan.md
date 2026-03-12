

# Analise do Relatorio Semanal

## Como funciona hoje

A Edge Function `generate-weekly-report` consolida entregas completadas da semana anterior (segunda a domingo), agrupando por **estabelecimento** e por **entregador**, e insere os resultados na tabela `financial_weekly_reports`. O admin dispara manualmente via botao "Gerar Relatorio" na pagina `/admin/financial`.

## Problemas encontrados

### 1. Bug no calculo de datas (Domingos)
Linha 24 do `generate-weekly-report`:
```
lastMonday.setDate(today.getDate() - dayOfWeek - 6)
```
Quando `dayOfWeek = 0` (domingo), calcula `date - 6`, pegando a segunda da semana **atual** (que ainda nao terminou). Deveria pegar a semana anterior completa.

### 2. Sem execucao automatica
Nao existe cron job configurado para rodar automaticamente. O admin precisa lembrar de clicar no botao toda semana. Se esquecer, o relatorio nao e gerado.

### 3. Sem backfill de semanas perdidas
A funcao so gera relatorio para UMA semana especifica (a ultima). Se perder uma semana, nao tem como recuperar.

### 4. Admin Financial carrega TODAS as entregas
`loadDeliverySummary()` (linha 74-77) faz `select` sem filtro de data - carrega todo o historico.

### 5. Nomes nao persistidos nos relatorios
Os nomes de estabelecimentos/entregadores sao resolvidos em tempo de exibicao. Se um estabelecimento mudar de nome, relatorios antigos mostram o nome novo.

## Plano de correcao

### Tarefa 1: Corrigir calculo de datas
Reescrever a logica para garantir que sempre pegue a ultima semana completa (seg-dom), independente do dia em que for executado.

### Tarefa 2: Adicionar suporte a backfill
Aceitar parametro opcional `week_start` no body da request para gerar relatorio de uma semana especifica. Sem parametro, gera a ultima semana completa.

### Tarefa 3: Configurar cron job automatico
Usar `pg_cron` para chamar a Edge Function toda segunda-feira as 03:00 UTC, garantindo geracao automatica.

### Tarefa 4: Adicionar filtro de data no summary do admin
Limitar `loadDeliverySummary` aos ultimos 90 dias, igual ja foi feito no Dashboard.

### Tarefa 5: Persistir nomes nos relatorios
Adicionar campo `entity_name` na tabela `financial_weekly_reports` e preencher no momento da geracao.

---

## Detalhes tecnicos

**Correcao de data:**
```javascript
// Correto: sempre pegar segunda passada
const dayOfWeek = today.getDay(); // 0=dom, 1=seg...
const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek + 6; // se dom, voltar 6; senao voltar ate seg anterior
const lastMonday = new Date(today);
lastMonday.setDate(today.getDate() - daysBack - (dayOfWeek === 0 ? 0 : dayOfWeek - 1));
```

Simplificando com abordagem mais clara:
```javascript
// Achar segunda da semana atual, depois subtrair 7
const mondayThisWeek = new Date(today);
mondayThisWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
const lastMonday = new Date(mondayThisWeek);
lastMonday.setDate(mondayThisWeek.getDate() - 7);
```

**Migracao para `entity_name`:**
```sql
ALTER TABLE financial_weekly_reports ADD COLUMN entity_name text DEFAULT '';
```

**Cron job:**
```sql
SELECT cron.schedule('generate-weekly-report', '0 3 * * 1',
  $$SELECT net.http_post(
    url := '...',
    headers := '{"Authorization": "Bearer ..."}'::jsonb
  )$$
);
```

