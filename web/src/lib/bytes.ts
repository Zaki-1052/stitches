// web/src/lib/bytes.ts — human-readable byte sizes for the kept-files UI (ADDONS §3.6).
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}
