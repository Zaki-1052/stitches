// importer/src/server.ts — entry point. Binds to localhost only (SPEC §3): nothing but
// Nginx (prod) or the Vite proxy (dev) ever reaches this process.
import { buildApp } from './app'
import { PORT } from './config'

const app = await buildApp()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ host: '127.0.0.1', port: PORT })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
