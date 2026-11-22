import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages sert le jeu sous /nokoue-rush/.
// Vercel le sert à la racine et pose VERCEL=1 pendant le build.
const base = process.env.VERCEL ? '/' : '/nokoue-rush/'

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-192-maskable.png',
        'icon-512-maskable.png',
        'manifest.webmanifest',
      ],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest,json,webp}'],
        navigateFallback: `${base}index.html`.replace('//', '/'),
        navigateFallbackDenylist: [/^\/api/, /\/rest\//, /supabase\./],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
  },
})
