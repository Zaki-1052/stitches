// web/src/features/shared/imagePipeline.ts — SPEC §8: every image upload runs this first.
// Decode → resize to ≤2000 px long edge → re-encode WebP at ~0.85 (JPEG when the browser can't
// encode WebP). Solves iPhone HEIC, PB's thumbnailer not reading HEIC, and multi-MB cell uploads.
//
// Trust-but-verify around browser-image-compression: it returns the ORIGINAL file when its
// output comes out larger (common for HEIC, which compresses better than WebP), and Safari's
// canvas silently substitutes formats it can't encode. So the library result only counts when
// its MIME matches the request; otherwise a plain-DOM canvas fallback re-encodes deterministically.
// An undecodable input (e.g. HEIC dropped into desktop Chrome) throws ImagePipelineError with the
// §8 "please convert this one" message.
import imageCompression from 'browser-image-compression'

export class ImagePipelineError extends Error {
  constructor() {
    super("We couldn't read that image. Please convert it and try again.")
    this.name = 'ImagePipelineError'
  }
}

export interface ProcessedImage {
  file: File
  previewUrl: string
}

const MAX_LONG_EDGE = 2000
const QUALITY = 0.85
// Comfortably under the tightest field cap (thumbnail ≤5 MB) so uploads stay fast on cell data.
const MAX_SIZE_MB = 4

type TargetType = 'image/webp' | 'image/jpeg'

// useWebWorker stays OFF: the library's worker importScripts() itself from the jsDelivr CDN
// (options.libURL default) — a hidden network dependency this self-hosted app must not have
// (same reasoning as self-hosted fonts, SPEC §5). Main-thread encode of a ≤2000 px image is fast.
async function compressWithLibrary(input: File, fileType: TargetType): Promise<File> {
  return imageCompression(input, {
    maxWidthOrHeight: MAX_LONG_EDGE,
    maxSizeMB: MAX_SIZE_MB,
    initialQuality: QUALITY,
    useWebWorker: false,
    fileType,
  })
}

function renameForType(name: string, fileType: TargetType): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo'
  return `${base}.${fileType === 'image/webp' ? 'webp' : 'jpg'}`
}

// Standard-DOM re-encode used when the library hands back an unconverted file.
async function encodeViaCanvas(input: File, fileType: TargetType): Promise<File | null> {
  const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, fileType, QUALITY))
    if (!blob || blob.type !== fileType) return null
    return new File([blob], renameForType(input.name, fileType), { type: fileType })
  } finally {
    bitmap.close()
  }
}

async function convertTo(input: File, fileType: TargetType): Promise<File | null> {
  const compressed = await compressWithLibrary(input, fileType)
  // The library returns a Blob with .name patched on (not a real File) — FormData would upload
  // it as "blob". Rewrap; and only trust it when the browser actually encoded the requested type
  // (Safari's canvas silently substitutes formats it can't encode).
  if (compressed.type === fileType) {
    return new File([compressed], renameForType(input.name, fileType), { type: fileType })
  }
  return encodeViaCanvas(input, fileType)
}

export async function processImage(input: File): Promise<ProcessedImage> {
  let output: File | null
  try {
    output = await convertTo(input, 'image/webp')
    if (!output) output = await convertTo(input, 'image/jpeg')
  } catch (err) {
    console.error('[imagePipeline] failed for', input.name, err)
    throw new ImagePipelineError()
  }
  if (!output) {
    console.error('[imagePipeline] no encodable output for', input.name)
    throw new ImagePipelineError()
  }
  return { file: output, previewUrl: URL.createObjectURL(output) }
}

// Per-file success/failure so one bad HEIC doesn't sink the other four in a multi-select.
export async function processImages(
  inputs: File[],
): Promise<{ succeeded: ProcessedImage[]; failed: { name: string; message: string }[] }> {
  const results = await Promise.allSettled(inputs.map(processImage))
  const succeeded: ProcessedImage[] = []
  const failed: { name: string; message: string }[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') succeeded.push(result.value)
    else failed.push({ name: inputs[i].name, message: (result.reason as Error).message })
  })
  return { succeeded, failed }
}

export function revokePreview(url: string) {
  URL.revokeObjectURL(url)
}
