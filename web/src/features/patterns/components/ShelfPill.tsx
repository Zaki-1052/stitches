// web/src/features/patterns/components/ShelfPill.tsx — the shelf segmented pill, icon-led per
// DESIGN §3: saved = neutral outline · want to make = coral heart · queued = lilac list. Used as
// the form's shelf field and the detail page's quick switcher (optimistic mutation there).
import { Bookmark, Heart, ListTodo } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SHELVES, SHELF_LABELS } from '../../../lib/schema.ts'
import type { Shelf, TagColor } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'

const SHELF_ICONS: Record<Shelf, LucideIcon> = {
  saved: Bookmark,
  want_to_make: Heart,
  queued: ListTodo,
}

const SHELF_PATCH: Record<Shelf, TagColor | null> = {
  saved: null,
  want_to_make: 'coral',
  queued: 'lilac',
}

export function ShelfPill({
  value,
  onChange,
  disabled,
}: {
  value: Shelf
  onChange: (next: Shelf) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Shelf" className="flex flex-wrap gap-2">
      {SHELVES.map((shelf) => {
        const Icon = SHELF_ICONS[shelf]
        const patch = SHELF_PATCH[shelf]
        const selected = value === shelf
        const style = selected
          ? patch
            ? {
                background: patchSwatch(patch).soft,
                color: patchSwatch(patch).deep,
                borderColor: patchSwatch(patch).deep,
              }
            : {
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                borderColor: 'var(--color-base-content)',
              }
          : {
              background: 'var(--color-base-100)',
              color: 'var(--ink-muted)',
              borderColor: 'var(--color-base-300)',
            }
        return (
          <button
            key={shelf}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(shelf)}
            className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold"
            style={style}
          >
            <Icon size={18} strokeWidth={2} />
            {SHELF_LABELS[shelf]}
          </button>
        )
      })}
    </div>
  )
}
