// web/vite.config.ts — dev server proxies PocketBase (/api, /_) and the importer (/import)
// so the app is same-origin in dev exactly like prod. No CORS config exists in this project.
// `vite preview` inherits proxy + allowedHosts from `server` (Vite 7 defaults), so the built
// PWA is device-testable behind `tailscale serve` with no extra config.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // SPEC §11: generateSW + autoUpdate; precache the shell, runtime-cache fonts and record
    // thumbnails, never touch anything else under /api. Full offline stays in Phase 5.
    VitePWA({
      registerType: 'autoUpdate',
      // SW is a production artifact only — dev/device testing of it goes through `npm run
      // preview` on a real build.
      devOptions: { enabled: false },
      manifest: {
        // lowercase wordmark everywhere (DECISIONS 2026-07-11)
        name: 'stitches',
        short_name: 'stitches',
        description: 'A private crochet pattern library and craft journal.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // DESIGN §12 #13 — mirrors --color-base-200 (manifest values can't reference CSS tokens)
        background_color: '#FAF4E9',
        theme_color: '#FAF4E9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // woff2 deliberately absent: @fontsource ships ~35 unicode-range subsets and the browser
        // only ever requests the used ones — they runtime-cache below instead of bloating install.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // The lazy pdfjs chunk is ~416 kB and useless offline (a PDF import can't upload without
        // a network anyway) — keep SW install light on cell data. Its worker (.mjs) never
        // matches the globs. If the chunk name ever changes it just precaches again: soft.
        globIgnores: ['**/pdf-*.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_/, /^\/import/],
        // Ordered — first match wins. File URLs use PB's opaque collectionId (SDK-verified), so
        // the reliable signals are the query params: every protected fetch carries ?token=,
        // every list/grid image carries ?thumb=.
        runtimeCaching: [
          {
            // Protected attachments (the copyright vault): never cached, matched first.
            urlPattern: /\/api\/files\/.*[?&]token=/,
            handler: 'NetworkOnly',
          },
          {
            // Record thumbnails (SPEC §11: 30 d, ~300 entries).
            urlPattern: /\/api\/files\/.*[?&]thumb=/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'thumbnails',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Self-hosted font subsets, cached as actually requested.
            urlPattern: /\/assets\/.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Everything else under /api — records, realtime, originals, the file-token
            // endpoint — is live-only.
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  // The settings footer's version comes from package.json — one source of truth (bumped per
  // session, phase.session numbering).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: with registerType autoUpdate, every deploy re-downloads changed
        // precache entries — splitting the app code from rarely-changing vendors keeps those
        // updates small (4.2 bundle sanity; also clears the 500 kB single-chunk warning).
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          vendor: ['@tanstack/react-query', 'pocketbase', 'zod', 'motion'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8090',
      '/_': 'http://127.0.0.1:8090',
      '/import': 'http://127.0.0.1:8095',
    },
    // device testing via `tailscale serve` (SPEC §4) — dev config only
    allowedHosts: ['.ts.net'],
  },
})
