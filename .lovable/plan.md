

# Turbinar a Seção Financeira

## Problemas atuais
- Relatórios mostram linhas duplicadas (mesmo entregador aparece N vezes se tem entregas em semanas diferentes)
- Sem chave PIX cadastrada para entregadores
- Falta clareza sobre quanto cobrar de cada estabelecimento vs quanto repassar aos entregadores
- Interface não diferencia bem "cobrar do estabelecimento" vs "pagar ao entregador"

## O que será feito

### 1. Adicionar campo PIX na tabela `drivers`
Migração SQL para adicionar coluna `pix_key` (text, nullable) na tabela `drivers`. O entregador poderá cadastrar/editar sua chave PIX na página de perfil.

### 2. Tela de perfil do entregador com campo PIX
Adicionar um card "Chave PIX" na página `driver/Profile.tsx` com input editável e botão salvar. Exibir tipo de chave (CPF, telefone, e-mail, aleatória) automaticamente.

### 3. Reformular a seção de relatórios no Financial.tsx

**Visão por entidade consolidada:** Em vez de listar cada linha de relatório separadamente, agrupar por entidade (entregador ou estabelecimento), mostrando:
- Nome + chave PIX (para entregadores)
- Total de entregas no período selecionado
- Valor bruto total
- Taxa da plataforma
- Valor líquido (repasse para entregador / a cobrar do estabelecimento)
- Status de pagamento (pendente/pago)
- Botão expandir para ver detalhamento por semana

**Separação clara das duas abas:**
- **Estabelecimentos** (titulo: "A Cobrar"): mostra quanto cada estabelecimento deve pagar pela taxa da plataforma
- **Entregadores** (titulo: "Repasses"): mostra quanto pagar a cada entregador, com chave PIX visível para facilitar transferência

**Ação em lote:** Botão "Marcar todos como pago" para o período selecionado.

### 4. Edge Function sem alterações
A `generate-weekly-report` já gera dados corretos por entidade/semana. A consolidação visual será feita no frontend agrupando os registros.

## Detalhes técnicos

**Migração SQL:**
```sql
ALTER TABLE public.drivers ADD COLUMN pix_key text;
```

**Agrupamento no frontend (Financial.tsx):**
```typescript
// Agrupar relatórios por entity_id, somando totais
const grouped = reports.reduce((map, r) => {
  const existing = map.get(r.entity_id) || { ...defaults };
  existing.total_deliveries += r.total_deliveries;
  existing.total_value += r.total_value;
  // ...
  return map;
}, new Map());
```

**Perfil do entregador:** Adicionar input com máscara para PIX + upsert no Supabase ao salvar.

**Arquivos editados:**
- `src/pages/admin/Financial.tsx` — reformular tabelas com agrupamento, exibir PIX, ação em lote
- `src/pages/driver/Profile.tsx` — adicionar card de chave PIX editável
- Migração SQL — adicionar `pix_key` em `drivers`

