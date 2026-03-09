

# PWA Completo para Good Delivery

## O que será feito

1. **Instalar `vite-plugin-pwa`** e configurar no `vite.config.ts` com manifest completo
2. **Copiar as imagens enviadas** para o projeto:
   - Logo vermelha → ícone do PWA (gerar tamanhos 192x192 e 512x512)
   - Imagem preta com texto → Open Graph / social sharing
3. **Atualizar `index.html`** com metadados SEO otimizados para o Google:
   - Título: "Good Delivery - Always Ahead"
   - Descrição: "Plataforma de entregas rápidas e confiáveis. Gerencie pedidos, acompanhe entregadores em tempo real e otimize suas entregas."
   - Meta tags OG e Twitter apontando para a imagem social
   - Meta tags mobile (theme-color, apple-mobile-web-app)
4. **Criar manifest PWA** via plugin com:
   - Nome: "Good Delivery"
   - Nome curto: "GoodDelivery"
   - Descrição para o Google Play / instalação
   - Cores: vermelho (#E8272C) como theme_color e background
   - Ícones da logo vermelha
   - `display: "standalone"`, `orientation: "portrait"`
5. **Adicionar `navigateFallbackDenylist`** para `/~oauth` (obrigatório)
6. **Criar página `/install`** com instruções de instalação do app

## Detalhes Técnicos

- **Pacote**: `vite-plugin-pwa` adicionado ao projeto
- **vite.config.ts**: Plugin `VitePWA` configurado com `registerType: 'autoUpdate'`, manifest, workbox com denylist
- **Imagens**: Logo vermelha copiada para `public/pwa-192x192.png` e `public/pwa-512x512.png`; imagem social para `public/og-image.jpg`
- **index.html**: Tags `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable">`, OG/Twitter meta tags atualizadas
- **Nova rota `/install`**: Página simples com instruções de instalação e botão para trigger do prompt `beforeinstallprompt`
- **App.tsx**: Adicionar rota `/install`

## Textos para SEO/Google

- **Title**: "Good Delivery - Always Ahead | Entregas Rápidas"
- **Description**: "Plataforma inteligente de entregas sob demanda. Conecte estabelecimentos a entregadores em tempo real com rastreamento, fila automática e gestão financeira completa."
- **OG Description**: "Gerencie suas entregas com rapidez e eficiência. Good Delivery conecta seu negócio aos melhores entregadores da região."

