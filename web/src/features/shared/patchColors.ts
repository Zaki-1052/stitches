// web/src/features/shared/patchColors.ts — token lookups for the five patch accents (DESIGN §2/§3).
// Components never hardcode hex; they pull these CSS-var references keyed by the schema's tag
// color values. Chip anatomy: soft fill + deep text; selected chips flip to core fill + espresso.
import type { TagColor } from '../../lib/schema.ts'

export interface PatchSwatch {
  soft: string
  core: string
  deep: string
}

export const PATCH_SWATCHES: Record<TagColor, PatchSwatch> = {
  blue: { soft: 'var(--patch-blue-soft)', core: 'var(--patch-blue)', deep: 'var(--patch-blue-deep)' },
  coral: {
    soft: 'var(--patch-coral-soft)',
    core: 'var(--patch-coral)',
    deep: 'var(--patch-coral-deep)',
  },
  lilac: {
    soft: 'var(--patch-lilac-soft)',
    core: 'var(--patch-lilac)',
    deep: 'var(--patch-lilac-deep)',
  },
  mint: { soft: 'var(--patch-mint-soft)', core: 'var(--patch-mint)', deep: 'var(--patch-mint-deep)' },
  butter: {
    soft: 'var(--patch-butter-soft)',
    core: 'var(--patch-butter)',
    deep: 'var(--patch-butter-deep)',
  },
}

// A tag saved without a color degrades to neutral tones instead of crashing the chip.
export const NEUTRAL_SWATCH: PatchSwatch = {
  soft: 'var(--color-base-300)',
  core: 'var(--color-base-300)',
  deep: 'var(--ink-muted)',
}

export function patchSwatch(color: TagColor | ''): PatchSwatch {
  return color ? PATCH_SWATCHES[color] : NEUTRAL_SWATCH
}
