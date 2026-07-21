// web/src/features/shared/pdfThumbnail.ts — SPEC §8's PDF door: render page 1 to a canvas,
// encode WebP (JPEG when the browser won't encode WebP — same trust-but-verify rule as
// imagePipeline), and hand back a ProcessedImage for the normal thumbnail mechanics. The heavy
// library loads on demand via dynamic import; the worker is the self-hosted copy Vite emits
// from the ?url import (no CDN, same reasoning as imagePipeline's useWebWorker:false).
// Verified against the installed pdfjs-dist@5.7.284 types: RenderParameters wants `canvas`
// (canvasContext is the back-compat alternative and requires canvas:null — don't pass both).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProcessedImage } from './imagePipeline.ts'

export class PdfThumbnailError extends Error {
  constructor() {
    super("We couldn't make a thumbnail from that PDF, but you can add one after saving.")
    this.name = 'PdfThumbnailError'
  }
}

// Thumbnails don't need imagePipeline's full 2000px budget; 1800 keeps a letter-size scan
// crisp at the detail hero's 800x0 variant while encoding fast on-device.
const LONG_EDGE = 1800
const QUALITY = 0.85

function renameForType(name: string, fileType: 'image/webp' | 'image/jpeg'): string {
  const base = name.replace(/\.[^.]+$/, '') || 'pattern'
  return `${base}-page1.${fileType === 'image/webp' ? 'webp' : 'jpg'}`
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  sourceName: string,
  fileType: 'image/webp' | 'image/jpeg',
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, fileType, QUALITY))
  // Safari silently substitutes formats it can't encode — only trust a type match.
  if (!blob || blob.type !== fileType) return null
  return new File([blob], renameForType(sourceName, fileType), { type: fileType })
}

export async function renderPdfPageOneThumbnail(input: File): Promise<ProcessedImage> {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

    const data = new Uint8Array(await input.arrayBuffer())
    const loadingTask = pdfjs.getDocument({ data })
    try {
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: LONG_EDGE / Math.max(base.width, base.height) })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      await page.render({ canvas, viewport }).promise

      const file =
        (await encodeCanvas(canvas, input.name, 'image/webp')) ??
        (await encodeCanvas(canvas, input.name, 'image/jpeg'))
      if (!file) throw new Error('canvas produced no encodable output')
      return { file, previewUrl: URL.createObjectURL(file) }
    } finally {
      await loadingTask.destroy()
    }
  } catch (err) {
    console.error('[pdfThumbnail] failed for', input.name, err)
    throw new PdfThumbnailError()
  }
}
