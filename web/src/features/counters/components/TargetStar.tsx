// web/src/features/counters/components/TargetStar.tsx — target reached: ONE mint star pops
// (DESIGN §7's celebration hierarchy; the five-patch confetti stays reserved for finishing a
// project). Same geometry as StarConfetti's stars so every star is one hand's. Mounted from
// the local tap handler — never an effect (StrictMode) and never from realtime (the device
// that counted gets the pop). The caller gates on useReducedMotion.
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { STAR_PATH } from '../../projects/components/StarConfetti.tsx'
import { PATCH_SWATCHES } from '../../shared/patchColors.ts'

const STAR_MS = 700

export function TargetStar({ onComplete }: { onComplete: () => void }) {
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })
  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), STAR_MS)
    return () => clearTimeout(timer)
  }, [])

  const mint = PATCH_SWATCHES.mint.core

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center" aria-hidden="true">
      <motion.span
        initial={{ scale: 0, rotate: -24, opacity: 0 }}
        animate={{ scale: [0, 1.18, 1], rotate: 0, opacity: [0, 1, 1, 0] }}
        transition={{ duration: STAR_MS / 1000, ease: 'easeOut', times: [0, 0.35, 0.75, 1] }}
      >
        <svg width={96} height={96} viewBox="0 0 24 24">
          <path d={STAR_PATH} fill={mint} stroke={mint} strokeWidth={3} strokeLinejoin="round" />
        </svg>
      </motion.span>
    </div>
  )
}
