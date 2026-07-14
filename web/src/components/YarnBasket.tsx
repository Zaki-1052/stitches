// web/src/components/YarnBasket.tsx — Home's new-user empty-state illustration (DESIGN §6,
// binding): a chubby yarn basket with two balls and a crochet hook leaning out, star sprinkles
// in patch colors. Flat token fills only (referenced as var() so it reads on cream and navy in
// one asset), 2.5–3 px round strokes in espresso or a patch-deep, dashed-seam motif on the
// basket body, no gradients, no blur. Decorative — always paired with copy, so aria-hidden.
type YarnBasketProps = { size?: number; className?: string }

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  // A chubby four-point star (the shirt motif): points at the compass, soft waist between.
  const w = r * 0.32
  return (
    <path
      d={`M ${x} ${y - r}
          C ${x + w * 0.4} ${y - w} ${x + w} ${y - w * 0.4} ${x + r} ${y}
          C ${x + w} ${y + w * 0.4} ${x + w * 0.4} ${y + w} ${x} ${y + r}
          C ${x - w * 0.4} ${y + w} ${x - w} ${y + w * 0.4} ${x - r} ${y}
          C ${x - w} ${y - w * 0.4} ${x - w * 0.4} ${y - w} ${x} ${y - r} Z`}
      fill={fill}
    />
  )
}

export function YarnBasket({ size = 136, className }: YarnBasketProps) {
  return (
    <svg
      width={size}
      height={(size * 100) / 120}
      viewBox="0 0 120 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* star sprinkles */}
      <Star x={16} y={26} r={6} fill="var(--patch-mint)" />
      <Star x={106} y={18} r={7} fill="var(--patch-butter)" />
      <Star x={97} y={44} r={4.5} fill="var(--patch-coral)" />

      {/* crochet hook leaning out of the basket */}
      <g stroke="var(--color-base-content)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M88 16 L70 56" strokeWidth="3" />
        <path d="M88 16 C 93 12 97 16 94 21" strokeWidth="3" />
      </g>

      {/* yarn balls nestled in the basket */}
      <circle cx="44" cy="46" r="17" fill="var(--color-primary)" />
      <g
        stroke="var(--color-base-content)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M33 34 C 41 40 48 50 52 60" />
        <path d="M44 30 C 51 38 56 48 58 56" />
        <path d="M30 50 C 38 44 48 38 58 36" />
      </g>
      <circle cx="70" cy="50" r="13" fill="var(--patch-coral)" />
      <g
        stroke="var(--color-base-content)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M62 42 C 68 47 73 54 76 60" />
        <path d="M60 54 C 66 50 74 46 81 46" />
      </g>

      {/* basket body + dashed-seam weave */}
      <path
        d="M20 58 L100 58 C 100 58 98 84 88 88 C 78 92 42 92 32 88 C 22 84 20 58 20 58 Z"
        fill="var(--patch-butter)"
        stroke="var(--color-base-content)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g
        stroke="var(--patch-butter-deep)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.5 7"
      >
        <path d="M25 68 C 45 72 75 72 95 68" />
        <path d="M29 78 C 47 82 73 82 91 78" />
      </g>
      {/* basket rim */}
      <rect
        x="16"
        y="52"
        width="88"
        height="11"
        rx="5.5"
        fill="var(--patch-butter-soft)"
        stroke="var(--color-base-content)"
        strokeWidth="3"
      />
    </svg>
  )
}
