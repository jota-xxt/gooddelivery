

## Chat entre Entregador e Estabelecimento

### Banco de Dados

Criar tabela `chat_messages`:
- `id` (uuid, PK)
- `delivery_id` (uuid, FK -> deliveries.id) - chat vinculado a uma entrega ativa
- `sender_id` (uuid) - user_id de quem enviou
- `message` (text)
- `created_at` (timestamptz)

Habilitar Realtime na tabela para mensagens em tempo real.

RLS policies:
- SELECT/INSERT: permitir se o usuário é o entregador da entrega (via `drivers`) OU o estabelecimento da entrega (via `establishments`)

### Componentes

1. **`src/components/ChatDialog.tsx`** - Componente reutilizável de chat em dialog/drawer:
   - Recebe `deliveryId`, identifica automaticamente se o usuário é driver ou establishment
   - Lista mensagens em tempo real via Realtime subscription
   - Input para enviar mensagem
   - ScrollArea com auto-scroll para novas mensagens
   - Bolhas de chat estilizadas (remetente vs destinatário)
   - Badge com contagem de mensagens não lidas

2. **Integração nas páginas existentes:**
   - `Orders.tsx` (establishment): Botão de chat em cada card de entrega ativa (já tem ícone `MessageSquare` importado)
   - `Home.tsx` (driver): Botão de chat na entrega aceita/em andamento

### Fluxo
- Chat só disponível em entregas com status `accepted`, `collecting`, `delivering`
- Ao abrir o dialog, carrega histórico e inicia subscription Realtime
- Mensagens aparecem instantaneamente para ambos os lados

### Arquivos Alterados
| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Tabela `chat_messages` + RLS + Realtime |
| `src/components/ChatDialog.tsx` | Novo componente de chat |
| `src/pages/establishment/Orders.tsx` | Botão de chat nos cards |
| `src/pages/driver/Home.tsx` | Botão de chat na entrega ativa |

