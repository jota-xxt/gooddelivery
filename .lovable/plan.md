

# Plano de Verificação Completa - Good Delivery

## Visao Geral

Varredura sistematica em 8 areas funcionais criticas, cobrindo autenticacao, fluxo de entregas, notificacoes, seguranca, performance e integridade de dados.

---

## 1. Autenticacao e Controle de Acesso

**O que verificar:**
- Login com os 3 perfis de teste (admin, estabelecimento, entregador)
- Registro wizard de 3 etapas (entregador e estabelecimento)
- Redirecionamento correto por role (admin -> /admin, driver -> /driver, establishment -> /establishment)
- RoleGuard bloqueando acesso cruzado (ex: entregador acessando /admin)
- Pagina PendingApproval exibindo mensagens corretas por status (pending, rejected, suspended)
- Sessao persistente apos reload (AuthContext com localStorage)
- SignOut limpando estado corretamente

**Problemas potenciais identificados:**
- `Register.tsx` linha 107: delay de 500ms antes de inserir dados role-especificos pode causar race condition se o trigger `handle_new_user` nao tiver completado
- AuthContext nao re-fetch role/status quando usuario e aprovado (requer logout/login)

---

## 2. Fluxo Completo de Entregas

**O que verificar:**
- Estabelecimento cria entrega (validacao de campos, fee > 0, endereco min 5 chars)
- Modo Pool: entrega aparece para todos os drivers online
- Modo Queue: `process-delivery-queue` seleciona driver correto (FIFO, sem bloqueio, sem entrega ativa)
- Driver aceita entrega -> status "accepted"
- Avanco de status: accepted -> collecting -> delivering -> completed
- Cancelamento por admin com motivo
- Rejeicao de oferta em modo queue com penalidade apos threshold
- Timer de 60s para oferta expirar
- Realtime: mudancas refletem em tempo real para todos os perfis

**Problemas potenciais identificados:**
- `DriverHome.tsx` linha 71: cast `(driverData as any).blocked_until` - campo pode nao existir nos types gerados
- `process-delivery-queue`: query N+1 - para cada driver online, faz 2 queries adicionais (blocked_until + active deliveries)
- Sem tratamento de concorrencia atomica no accept em modo pool (dois drivers podem aceitar simultaneamente, embora o `.eq('status', 'searching')` mitigue parcialmente)

---

## 3. Notificacoes (Push + WhatsApp + In-App)

**O que verificar:**
- Chaves VAPID existem em `app_settings`
- Subscribe push: permissao -> SW ready -> subscribe -> salvar no DB
- `send-push` Edge Function: encriptacao aesgcm, VAPID JWT, cleanup de subscriptions invalidas
- WhatsApp: templates para 9 eventos (registro, aprovacao, rejeicao, aceite, coleta, entrega, conclusao, cancelamento, oferta)
- Notificacoes in-app: insert correto, contagem de nao-lidas no layout

**Problemas potenciais identificados:**
- `usePushNotifications.ts`: `applicationServerKey: appServerKey.buffer as ArrayBuffer` - em alguns browsers o buffer pode ser SharedArrayBuffer, causando erro
- Service Worker `push-sw.js` precisa estar na raiz publica e registrado corretamente
- `sendWhatsApp` e `sendPush` no `update-delivery-status` usam fire-and-forget (`fetch().catch(() => {})`) - falhas silenciosas

---

## 4. Seguranca e RLS

**O que verificar:**
- Todas as 10 tabelas tem RLS ativado
- `user_roles` nao permite UPDATE/DELETE por usuarios comuns
- `profiles` nao expoe dados de outros usuarios (exceto admin e establishments vendo drivers)
- `deliveries` nao permite DELETE por ninguem
- `push_subscriptions` isolada por user_id
- Edge Functions validam auth header e user identity
- `update-delivery-status` valida role e ownership antes de cada acao

**Problemas potenciais identificados:**
- `chat_messages` RLS usa `{public}` em vez de `{authenticated}` nos roles - qualquer request anonimo poderia tentar
- `delivery_offers` nao tem policy de INSERT para drivers (apenas admin ALL e driver SELECT)
- Cancelamento restrito apenas a admin - estabelecimento nao pode cancelar propria entrega

---

## 5. Performance e Queries

**O que verificar:**
- Dashboard admin: 6 queries paralelas no `fetchAll` - verificar tempo de resposta
- `DriverHome`: multiplos canais Realtime simultaneos (deliveries, offers, drivers, settings)
- `EstablishmentOrders`: query N+1 para buscar nomes de drivers (drivers -> profiles)
- Limite de 1000 rows do Supabase nao e problema para queries atuais (limit 20 em pool)

**Problemas potenciais identificados:**
- `AdminDashboard` faz `select('id, delivery_fee, status, created_at, accepted_at, delivered_at')` sem filtro de data - carrega TODAS as entregas
- `process-delivery-queue` faz queries sequenciais em loop (N+1) para cada driver
- Geocoding via Nominatim no `DriverHome` pode ser lento e rate-limited

---

## 6. Interface e Responsividade

**O que verificar:**
- Landing page renderiza corretamente em mobile (430px viewport atual)
- Bottom navigation funcional em todas as paginas driver/establishment
- Admin sidebar funcional em desktop e mobile
- Dialogs/modals de criacao de entrega responsivos
- Mapa Leaflet renderiza sem problemas de z-index
- Formularios com mascaras (telefone, CPF, CNPJ) funcionais

---

## 7. Edge Functions

**O que verificar todas deployadas e funcionais:**
- `update-delivery-status` - core do fluxo
- `process-delivery-queue` - distribuicao de entregas
- `send-push` - notificacoes push
- `send-whatsapp` - notificacoes WhatsApp
- `generate-weekly-report` - relatorio financeiro
- `expire-stale-offers` - limpeza de ofertas expiradas
- `seed-test-users` - seed com VAPID keys

---

## 8. Integridade de Dados

**O que verificar:**
- Trigger `handle_new_user` cria profile + role automaticamente no signup
- `updated_at` trigger existe e funciona nas tabelas relevantes
- Constraint unique em `push_subscriptions (user_id, endpoint)` para upsert
- Constraint unique em `user_roles (user_id, role)`
- Timestamps consistentes (UTC) em todas as operacoes

**Problemas potenciais identificados:**
- Schema mostra "There are no triggers in the database" - o trigger `handle_new_user` pode ter sido removido durante resets
- Sem foreign keys explicitas de `deliveries.driver_id -> drivers.id` e `deliveries.establishment_id -> establishments.id` no schema reportado

---

## Prioridade de Execucao

| Prioridade | Area | Risco |
|---|---|---|
| P0 | Triggers do banco (handle_new_user) | Registro quebrado |
| P0 | RLS chat_messages com role public | Seguranca |
| P0 | delivery_offers sem INSERT policy | Queue mode quebrado |
| P1 | Race condition no registro | Dados inconsistentes |
| P1 | Dashboard sem filtro de data | Performance |
| P1 | N+1 queries no queue processor | Performance |
| P2 | Fire-and-forget em notificacoes | Notificacoes perdidas |
| P2 | Push compatibility (SharedArrayBuffer) | Push falhando |

---

## Acoes Concretas

1. **Verificar trigger `handle_new_user`** - confirmar que existe e esta ativo via query
2. **Corrigir RLS de `chat_messages`** - mudar roles de `{public}` para `{authenticated}`
3. **Adicionar INSERT policy em `delivery_offers`** para o service_role (ja funciona via admin client nas Edge Functions, mas boa pratica)
4. **Adicionar filtro de data no Dashboard** para limitar queries
5. **Testar fluxo completo** end-to-end: registro -> aprovacao -> criar entrega -> aceitar -> completar
6. **Testar push notifications** em Android (PWA instalado)
7. **Verificar integridade das VAPID keys** no banco

