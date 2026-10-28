import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/app-check'] }
      }
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TubigLink Alegria',
        short_name: 'TubigLink',
        description: 'Report water shortages, find verified distribution schedules and track your request in Alegria, Cebu.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f8fb',
        theme_color: '#0b66c3',
        categories: ['utilities', 'government'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache only the app shell. Firestore and Cloud Functions calls are never cached or queued,
        // so the app cannot show a "received" confirmation that the server did not give.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: []
      }
    })
  ]
})
