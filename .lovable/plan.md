

# Plano: Sistema de Mapas com Leaflet + Nominatim

## Visão Geral

Adicionar mapas interativos em 3 áreas da plataforma usando **Leaflet** (gratuito, sem API key) com busca de endereço via **Nominatim** (OpenStreetMap). Será necessário adicionar as dependências `leaflet` e `react-leaflet`.

---

## 1. Componente reutilizável de Mapa

**Novo arquivo:** `src/components/MapPicker.tsx`

Componente genérico que aceita:
- `mode`: `"view"` (apenas exibir pins) ou `"pick"` (clicar para selecionar local)
- `markers`: array de `{ lat, lng, label, color }`
- `onLocationSelect`: callback quando usuário clica no mapa (modo pick)
- `searchEnabled`: habilita barra de busca Nominatim
- `center` / `zoom`: posição inicial

Inclui barra de busca que consulta `https://nominatim.openstreetmap.org/search` com debounce de 500ms.

---

## 2. Localização do Estabelecimento (Perfil)

**Arquivo:** `src/pages/establishment/Profile.tsx`

- Adicionar botão "Definir localização no mapa"
- Abre modal com `MapPicker` em modo `pick` + busca Nominatim
- Ao confirmar, salva `latitude` e `longitude` na tabela `establishments`

**Migration:** Adicionar colunas `latitude` e `longitude` na tabela `establishments`:
```sql
ALTER TABLE public.establishments 
  ADD COLUMN latitude double precision DEFAULT NULL,
  ADD COLUMN longitude double precision DEFAULT NULL;
```

---

## 3. Entrega Ativa (Tela do Entregador)

**Arquivo:** `src/pages/driver/Home.tsx`

- No card de entrega ativa, adicionar um mapa abaixo do stepper mostrando 2 pins:
  - Pin azul: endereço do estabelecimento (coleta)
  - Pin verde: endereço de entrega
- Geocodificar os endereços via Nominatim ao carregar a entrega
- Mapa com ~200px de altura, clicável para abrir no Google Maps

---

## 4. Painel Admin - Mapa de Entregas

**Novo arquivo:** `src/pages/admin/MapOverview.tsx`

- Nova rota `/admin/map` no layout admin
- Mapa fullscreen mostrando:
  - Entregas ativas (pins coloridos por status)
  - Entregadores online (pins azuis)
- Sidebar com lista de entregas ativas clicáveis
- Geocodifica endereços e cacheia no state

**Arquivos afetados:** `src/App.tsx` (nova rota), `src/components/AdminSidebar.tsx` (novo link)

---

## 5. Componente de busca de endereço Nominatim

**Novo arquivo:** `src/components/AddressSearch.tsx`

Input com autocomplete que consulta Nominatim, retorna lat/lng + endereço formatado. Reutilizado no MapPicker e no formulário de nova entrega do estabelecimento.

---

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | `latitude`/`longitude` em `establishments` |
| `src/components/MapPicker.tsx` | Novo - componente de mapa reutilizável |
| `src/components/AddressSearch.tsx` | Novo - busca Nominatim com autocomplete |
| `src/pages/establishment/Profile.tsx` | Adicionar seletor de localização no mapa |
| `src/pages/driver/Home.tsx` | Mapa na entrega ativa com pins coleta/entrega |
| `src/pages/admin/MapOverview.tsx` | Novo - painel de mapa do admin |
| `src/App.tsx` | Nova rota `/admin/map` |
| `src/components/AdminSidebar.tsx` | Link para mapa |
| `package.json` | Dependências: `leaflet`, `react-leaflet`, `@types/leaflet` |

