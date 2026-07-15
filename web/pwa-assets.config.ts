// web/pwa-assets.config.ts — icon generation for `npm run icons` (@vite-pwa/assets-generator).
// One full-bleed, safe-zone-composed master (public/favicon.svg) feeds every variant, so all
// padding is 0 and no background override is needed — the minimal-2023 defaults (0.3 padding,
// white fill on maskable/apple) exist for transparent logo sources, which this is not.
// Outputs land beside the source in web/public/ and are committed:
//   favicon.ico · pwa-64x64.png · pwa-192x192.png · pwa-512x512.png ·
//   maskable-icon-512x512.png · apple-touch-icon-180x180.png
import { defineConfig } from '@vite-pwa/assets-generator/config'
import type { Preset } from '@vite-pwa/assets-generator/config'

const fullBleedPreset: Preset = {
  transparent: {
    sizes: [64, 192, 512],
    favicons: [[48, 'favicon.ico']],
    padding: 0,
  },
  maskable: {
    sizes: [512],
    padding: 0,
  },
  apple: {
    sizes: [180],
    padding: 0,
  },
}

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: fullBleedPreset,
  images: ['public/favicon.svg'],
})
