// web/src/features/patterns/components/FilterSheet.tsx — the filter bottom sheet (DESIGN §8:
// daisyUI modal, native <dialog>, bottom variant, drag handle). Selections are DRAFT state while
// the sheet is open; one Apply commits everything in a single URL replace, so the query and
// history never churn per checkbox tap. Esc/backdrop discards the draft.
import { useEffect, useRef, useState } from 'react'
import {
  CRAFTS,
  CRAFT_LABELS,
  SHELVES,
  SHELF_LABELS,
  YARN_WEIGHTS,
} from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { useTags } from '../queries.ts'
import { EMPTY_FILTERS } from '../urlParams.ts'
import type { LibraryFilters } from '../urlParams.ts'

function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterChip({
  label,
  selected,
  onToggle,
  selectedStyle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
  selectedStyle?: React.CSSProperties
}) {
  const style = selected
    ? (selectedStyle ?? {
        background: 'var(--patch-blue-soft)',
        color: 'var(--patch-blue-deep)',
        borderColor: 'var(--patch-blue-deep)',
      })
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function FilterSheet({
  open,
  filters,
  onApply,
  onClose,
}: {
  open: boolean
  filters: LibraryFilters
  onApply: (next: LibraryFilters) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<LibraryFilters>(filters)
  const tagsQuery = useTags()

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

        <Group title="Shelf">
          {SHELVES.map((shelf) => (
            <FilterChip
              key={shelf}
              label={SHELF_LABELS[shelf]}
              selected={draft.shelf.includes(shelf)}
              onToggle={() => setDraft({ ...draft, shelf: toggled(draft.shelf, shelf) })}
            />
          ))}
        </Group>

        <Group title="Craft">
          {CRAFTS.map((craft) => (
            <FilterChip
              key={craft}
              label={CRAFT_LABELS[craft]}
              selected={draft.craft.includes(craft)}
              onToggle={() => setDraft({ ...draft, craft: toggled(draft.craft, craft) })}
            />
          ))}
        </Group>

        <Group title="Yarn weight">
          {YARN_WEIGHTS.map((weight) => (
            <FilterChip
              key={weight}
              label={CYC_LABELS[weight]}
              selected={draft.weight.includes(weight)}
              onToggle={() => setDraft({ ...draft, weight: toggled(draft.weight, weight) })}
            />
          ))}
        </Group>

        {(tagsQuery.data?.length ?? 0) > 0 && (
          <Group title="Tags">
            {tagsQuery.data!.map((tag) => {
              const swatch = patchSwatch(tag.color)
              return (
                <FilterChip
                  key={tag.id}
                  label={tag.name}
                  selected={draft.tags.includes(tag.id)}
                  onToggle={() => setDraft({ ...draft, tags: toggled(draft.tags, tag.id) })}
                  selectedStyle={{
                    background: swatch.soft,
                    color: swatch.deep,
                    borderColor: swatch.deep,
                  }}
                />
              )
            })}
          </Group>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={() => setDraft({ ...EMPTY_FILTERS, q: draft.q })}
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
            Show patterns
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close filters">close</button>
      </form>
    </dialog>
  )
}
