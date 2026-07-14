// importer/build.mjs — single-file production bundle (SPEC §10: dist/server.mjs, no npm
// install on the VPS). The createRequire banner is required, not defensive: fastify's CJS
// dependency graph leaves a `typeof require` shim in esbuild's ESM output, and real Node
// ESM has no global require — without the banner the first exercised require() crashes.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: false,
  legalComments: 'none',
  banner: {
    js: [
      "import { createRequire as __importerCreateRequire } from 'node:module';",
      "import { fileURLToPath as __importerFileURLToPath } from 'node:url';",
      "import { dirname as __importerDirname } from 'node:path';",
      'const require = __importerCreateRequire(import.meta.url);',
      'const __filename = __importerFileURLToPath(import.meta.url);',
      'const __dirname = __importerDirname(__filename);',
    ].join('\n'),
  },
})
