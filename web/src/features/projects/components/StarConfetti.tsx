// web/src/features/projects/components/StarConfetti.tsx — the finished celebration (DESIGN §7:
// star confetti in all five patches, ≤1.5 s, once). Stars follow the motif rules (§6): flat
// patch-core fills, chubby geometry — the same-color round-join stroke is what plumps the tips,
// not an outline. Animates transform/opacity only. The page decides whether to mount this at
// all (useReducedMotion gates it in JS — the base.css kill-switch only reaches CSS animations);
// the run itself starts from a mutation callback, so it fires exactly once per finish.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { TAG_COLORS } from '../../../lib/schema.ts'
import { PATCH_SWATCHES } from '../../shared/patchColors.ts'

const STAR_COUNT = 24
const CONFETTI_MS = 1500

// Plump 5-point star on the 24 px icon grid.
const STAR_PATH =
  'M12 3 L14.59 8.44 L20.56 9.22 L16.18 13.36 L17.29 19.28 L12 16.4 L6.71 19.28 ' +
  'L7.82 13.36 L3.44 9.22 L9.41 8.44 Z'

interface Star {
  left: number
  size: number
  color: string
  delay: number
  duration: number
  rotateFrom: number
  rotateTo: number
}

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    left: 2 + Math.random() * 92,
    size: 16 + Math.random() * 12,
    color: PATCH_SWATCHES[TAG_COLORS[i % TAG_COLORS.length]].core,
    delay: Math.random() * 0.35,
    duration: 0.9 + Math.random() * 0.2,
    rotateFrom: Math.random() * 360,
    rotateTo: Math.random() * 360 + (Math.random() < 0.5 ? -220 : 220),
  }))
}

export function StarConfetti({ onComplete }: { onComplete: () => void }) {
  // Star geometry rolls once; re-renders must not reshuffle a falling sky.
  const [stars] = useState(makeStars)

  // Latest-ref so parent re-renders (query invalidations) can't reset the 1.5 s clock.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })
  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), CONFETTI_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {stars.map((star, i) => (
        <motion.span
          key={i}
          className="absolute top-0"
          style={{ left: `${star.left}%` }}
          initial={{ y: '-6dvh', rotate: star.rotateFrom, opacity: 1 }}
          animate={{ y: '105dvh', rotate: star.rotateTo, opacity: [1, 1, 0] }}
          transition={{ duration: star.duration, delay: star.delay, ease: 'easeIn' }}
        >
          <svg width={star.size} height={star.size} viewBox="0 0 24 24">
            <path
              d={STAR_PATH}
              fill={star.color}
              stroke={star.color}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      ))}
    </div>
  )
}
