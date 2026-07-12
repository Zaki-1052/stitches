// web/src/features/patterns/components/MetaChips.tsx — the detail page's fact chips (DESIGN §9):
// craft, CYC weight ("4 · Medium/Worsted"), hook with alias ("5.0 mm · H-8"), gauge, yardage,
// difficulty. Purely informational, and empty fields simply don't render a chip.
import { CRAFT_LABELS, DIFFICULTY_LABELS } from '../../../lib/schema.ts'
import type { PatternRecord } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { formatHook } from '../../../lib/hooks.ts'

function yardageLabel(pattern: PatternRecord): string | null {
  const { yardage, yardage_max } = pattern
  if (yardage && yardage_max) return `${yardage}–${yardage_max} yd`
  if (yardage) return `${yardage} yd`
  if (yardage_max) return `up to ${yardage_max} yd`
  return null
}

export function MetaChips({ pattern }: { pattern: PatternRecord }) {
  const chips: string[] = []
  if (pattern.craft) chips.push(CRAFT_LABELS[pattern.craft])
  if (pattern.yarn_weight) chips.push(CYC_LABELS[pattern.yarn_weight])
  if (pattern.hook_mm) chips.push(formatHook(pattern.hook_mm))
  if (pattern.gauge) chips.push(pattern.gauge)
  const yardage = yardageLabel(pattern)
  if (yardage) chips.push(yardage)
  if (pattern.difficulty) chips.push(DIFFICULTY_LABELS[pattern.difficulty])

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((label) => (
        <span
          key={label}
          className="rounded-full border-[1.5px] bg-base-100 px-3 py-1.5 text-sm font-semibold"
          style={{ borderColor: 'var(--color-base-300)' }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
