import { env } from 'node:process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Use /garderob/ for GitHub Pages; local development keeps the root path.
const base = env.PAGES_BASE_PATH || '/';
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'demo/*', 'fonts/*'],
      manifest: {
        name: 'Pink Wardrobe — личный гардероб',
        short_name: 'Pink Wardrobe',
        lang: 'ru',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FFF7FA',
        theme_color: '#FFF7FA',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,png,webp,woff2,svg}'],
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});

