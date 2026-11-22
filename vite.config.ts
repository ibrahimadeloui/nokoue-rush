import { defineConfig } from 'vite'

// GitHub Pages sert le jeu sous /nokoue-rush/.
// Vercel le sert à la racine et pose VERCEL=1 pendant le build.
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/nokoue-rush/',
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
