

# Plano: Sistema Financeiro Completo

## O que existe hoje

- **Admin Financial**: Tabela simples agrupando entregas concluídas por estabelecimento, calculando taxa e repasse no frontend. Sem filtros, sem período, sem visão por entregador.
- **Driver Earnings**: Cards básicos (hoje/semana/mês) sem lista detalhada de corridas.
- **Establishment History**: Lista de entregas passadas sem resumo financeiro.
- **Settings**: Campo para configurar % da taxa da plataforma.

## O que será construído

### 1. Banco de Dados — Nova tabela `financial_weekly_reports`

Tabela para armazenar relatórios semanais consolidados, gerados automaticamente por uma Edge Function agendada via `pg_cron`.

```text
financial_weekly_reports
├── id (uuid, PK)
├── week_start (date)
├── week_end (date)
├── entity_type ('establishment' | 'driver')
├── entity_id (uuid) — referência ao establishment ou driver
├── user_id (uuid) — para RLS
├── total_deliveries (int)
├── total_value (numeric)
├── platform_fee (numeric)
├── net_payout (numeric)
├── status ('pending' | 'paid')
├── created_at (timestamptz)
```

RLS: usuários veem seus próprios relatórios; admin vê todos.

### 2. Edge Function — `generate-weekly-report`

Função que consolida entregas `completed` da semana anterior, agrupa por estabelecimento e por entregador, e insere na tabela `financial_weekly_reports`. Será chamada via `pg_cron` toda segunda-feira.

### 3. Admin — Relatório Financeiro Completo (`admin/Financial.tsx`)

Reescrita completa da página:

- **Filtro de período**: Selector de semana (dropdown com semanas disponíveis) + opção "Todos os tempos"
- **Cards resumo**: Total de entregas, Receita bruta, Taxa da plataforma, Repasse total
- **Tabs**: "Por Estabelecimento" e "Por Entregador"
  - Tabela detalhada com nome, entregas, valor bruto, taxa, repasse líquido
  - Coluna de status de pagamento (Pendente/Pago) com botão para marcar como pago
- **Exportar**: Botão para baixar CSV do relatório filtrado

### 4. Entregador — Ganhos Detalhados (`driver/Earnings.tsx`)

Evolução da página:

- **Cards resumo**: Hoje, Semana, Mês, Total (mantém)
- **Nova seção**: Lista de entregas concluídas com data, estabelecimento, valor bruto, taxa descontada, valor líquido recebido
- **Filtro por período**: Hoje / Esta semana / Este mês / Personalizado
- **Resumo semanal**: Cards com relatórios semanais fechados (da tabela `financial_weekly_reports`)

### 5. Estabelecimento — Aba Financeiro (`establishment/Financial.tsx`)

Nova página no painel do estabelecimento:

- **Cards resumo**: Total gasto no período, Quantidade de entregas, Taxa média
- **Lista de entregas**: Detalhamento por corrida (cliente, entregador, valor, data)
- **Relatórios semanais**: Resumo semanal consolidado com status de pagamento
- **Adição na BottomNav** e nas rotas do App.tsx

### 6. Detalhes técnicos

- A Edge Function `generate-weekly-report` usa `SUPABASE_SERVICE_ROLE_KEY` (já configurado) para bypass de RLS ao inserir relatórios
- `pg_cron` + `pg_net` para agendar a execução toda segunda às 03:00
- Filtros de data usam `date-fns` (já instalado)
- CSV export feito no frontend com `Blob` + `URL.createObjectURL` (sem dependência extra)

### Resumo de mudanças

| Componente | Ação |
|---|---|
| Migration SQL | Criar tabela `financial_weekly_reports` + RLS + enum |
| `supabase/functions/generate-weekly-report/index.ts` | Nova Edge Function |
| `pg_cron` schedule | Inserir via SQL (insert tool) |
| `src/pages/admin/Financial.tsx` | Reescrever com tabs, filtros, export |
| `src/pages/driver/Earnings.tsx` | Expandir com lista detalhada e filtros |
| `src/pages/establishment/Financial.tsx` | Nova página |
| `src/App.tsx` | Adicionar rota establishment/financial |
| `src/components/BottomNav.tsx` | Adicionar aba Financeiro no establishment |
| `supabase/config.toml` | Adicionar config da nova Edge Function |

