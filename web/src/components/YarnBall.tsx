// web/src/components/YarnBall.tsx — the Stitches yarn-ball mark (DESIGN §6, binding).
// "A thread draws a circle." Flat token fills only, referenced as var() so the mark flips with
// the theme and reads on both cream and stitchesdim navy in one asset. No gradients, no blur;
// 3px round strokes in espresso; round, chubby geometry. Decorative — always paired with text,
// so it's aria-hidden.
type YarnBallProps = { size?: number; className?: string }

export function YarnBall({ size = 112, className }: YarnBallProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="46" cy="52" r="30" fill="var(--color-primary)" />
      <g
        stroke="var(--color-base-content)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* winding — one diagonal set… */}
        <path d="M26 30 C 40 40 52 56 60 76" />
        <path d="M40 24 C 54 36 66 54 72 70" />
        <path d="M18 42 C 30 52 42 68 48 82" />
        {/* …crossed by the other */}
        <path d="M20 60 C 34 50 50 36 66 30" />
        <path d="M28 74 C 44 62 60 46 74 44" />
        {/* the loose tail, drawing outward */}
        <path d="M74 50 C 86 54 88 66 80 70 C 75 72 71 68 73 63" />
      </g>
    </svg>
  )
}
