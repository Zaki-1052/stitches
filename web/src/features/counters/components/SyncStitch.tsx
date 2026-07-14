// web/src/features/counters/components/SyncStitch.tsx — the tiny "syncing" stitch (DESIGN
// §10): visible in the surface's top corner while the outbox is non-empty. An X stitch per
// the §6 motif inventory — 3 px round-cap strokes, token color (primary reads on cream and
// on stitchesdim navy). The gentle CSS pulse dies under prefers-reduced-motion via base.css.
export function SyncStitch() {
  return (
    <span
      role="status"
      title="Syncing — your taps are saved"
      aria-label="Syncing — your taps are saved"
      className="grid size-6 animate-pulse place-items-center"
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6 L18 18 M18 6 L6 18"
          stroke="var(--color-primary)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
