// web/vite.config.ts — dev server proxies PocketBase (/api, /_) and the importer (/import)
// so the app is same-origin in dev exactly like prod. No CORS config exists in this project.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
