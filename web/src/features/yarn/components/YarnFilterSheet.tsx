// web/src/features/yarn/components/YarnFilterSheet.tsx — the stash's filter bottom sheet, a
// trimmed mirror of the Library's FilterSheet (native <dialog>, bottom variant, drag handle):
// one Yarn-weight group. Selections are DRAFT state while open; one Apply commits everything in
// a single URL replace. Esc/backdrop discards the draft.
import { useEffect, useRef, useState } from 'react'
import { YARN_WEIGHTS } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { EMPTY_YARN_FILTERS } from '../urlParams.ts'
import type { YarnFilters } from '../urlParams.ts'

function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterChip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  const style = selected
    ? {
        background: 'var(--patch-blue-soft)',
        color: 'var(--patch-blue-deep)',
        borderColor: 'var(--patch-blue-deep)',
      }
    : {
        background: 'var(--color-base-100)',
        color: 'var(--ink-muted)',
        borderColor: 'var(--color-base-300)',
      }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold"
      style={style}
    >
      {label}
    </button>
  )
}

export function YarnFilterSheet({
  open,
  filters,
  onApply,
  onClose,
}: {
  open: boolean
  filters: YarnFilters
  onApply: (next: YarnFilters) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<YarnFilters>(filters)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      setDraft(filters)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open, filters])

  return (
    <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
      <div className="modal-box flex flex-col gap-5 bg-base-100">
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'var(--color-base-300)' }}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
            Yarn weight
          </h3>
          <div className="flex flex-wrap gap-2">
            {YARN_WEIGHTS.map((weight) => (
              <FilterChip
                key={weight}
                label={CYC_LABELS[weight]}
                selected={draft.weight.includes(weight)}
                onToggle={() => setDraft({ ...draft, weight: toggled(draft.weight, weight) })}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={() => setDraft({ ...EMPTY_YARN_FILTERS, q: draft.q })}
          >
            Clear all
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg flex-1"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Show yarn
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close filters">close</button>
      </form>
    </dialog>
  )
}
