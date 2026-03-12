

# Fix: PWA com manifests dinâmicos por rota

## Problema
O PWA sempre abre em `/` (start_url do manifest único), independente de onde o usuário instalou. Entregadores que instalam de `/driver` são redirecionados para a landing page.

## Solução

### 1. Criar 4 manifests estáticos em `public/`

- `manifest.webmanifest` — start_url: `/`, scope: `/`
- `manifest-admin.webmanifest` — start_url: `/admin`, scope: `/`
- `manifest-driver.webmanifest` — start_url: `/driver`, scope: `/`
- `manifest-establishment.webmanifest` — start_url: `/establishment`, scope: `/`

Todos com o mesmo nome, ícones, cores e `display: standalone`. O `scope` fica `/` em todos para não bloquear navegação entre rotas (login, etc).

### 2. Adicionar `<link rel="manifest">` + script dinâmico no `index.html`

Inserir no `<head>`:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<script>
  (function() {
    var p = window.location.pathname;
    var h = '/manifest.webmanifest';
    if (p.indexOf('/admin') === 0) h = '/manifest-admin.webmanifest';
    else if (p.indexOf('/driver') === 0) h = '/manifest-driver.webmanifest';
    else if (p.indexOf('/establishment') === 0) h = '/manifest-establishment.webmanifest';
    document.querySelector('link[rel="manifest"]').setAttribute('href', h);
  })();
</script>
```

### 3. Desabilitar manifest automático do vite-plugin-pwa

No `vite.config.ts`, trocar o objeto `manifest: { ... }` por `manifest: false`. O plugin continua gerando o service worker normalmente, mas não injeta o manifest — usaremos os arquivos estáticos.

### Arquivos
- **Criar**: `public/manifest.webmanifest`, `public/manifest-admin.webmanifest`, `public/manifest-driver.webmanifest`, `public/manifest-establishment.webmanifest`
- **Editar**: `index.html` (adicionar link + script), `vite.config.ts` (manifest: false)

