// web/src/features/patterns/components/ActiveFilterChips.tsx — the horizontal chip row under the
// search bar: a "Filters" opener (with active count) plus one removable chip per active
// selection. Tag chips resolve names from the loaded tag list; a stale tag id from an old URL
// simply renders no chip (it also matches no patterns).
import { SlidersHorizontal, X } from 'lucide-react'
import { CRAFT_LABELS, SHELF_LABELS } from '../../../lib/schema.ts'
import type { TagRecord } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { countActiveFilters } from '../urlParams.ts'
import type { LibraryFilters } from '../urlParams.ts'

export type FilterGroup = 'shelf' | 'craft' | 'weight' | 'tags'

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove filter: ${label}`}
      onClick={onRemove}
      className="flex h-11 shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3 text-sm font-semibold"
      style={{
        background: 'var(--patch-blue-soft)',
        color: 'var(--patch-blue-deep)',
        borderColor: 'var(--patch-blue-deep)',
      }}
    >
      {label}
      <X size={14} strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}

export function ActiveFilterChips({
  filters,
  tags,
  onOpenSheet,
  onRemove,
}: {
  filters: LibraryFilters
  tags: TagRecord[]
  onOpenSheet: () => void
  onRemove: (group: FilterGroup, value: string) => void
}) {
  const count = countActiveFilters(filters)
  const tagName = (id: string) => tags.find((tag) => tag.id === id)?.name

  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">
      <button
        type="button"
        onClick={onOpenSheet}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold"
        style={{
          background: 'var(--color-base-100)',
          color: 'var(--color-base-content)',
          borderColor: 'var(--color-base-300)',
        }}
      >
        <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
        Filters
        {count > 0 && (
          <span
            className="grid size-5 place-items-center rounded-full text-xs font-bold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}
          >
            {count}
          </span>
        )}
      </button>

      {filters.shelf.map((value) => (
        <RemovableChip
          key={`shelf-${value}`}
          label={SHELF_LABELS[value]}
          onRemove={() => onRemove('shelf', value)}
        />
      ))}
      {filters.craft.map((value) => (
        <RemovableChip
          key={`craft-${value}`}
          label={CRAFT_LABELS[value]}
          onRemove={() => onRemove('craft', value)}
        />
      ))}
      {filters.weight.map((value) => (
        <RemovableChip
          key={`weight-${value}`}
          label={CYC_LABELS[value]}
          onRemove={() => onRemove('weight', value)}
        />
      ))}
      {filters.tags.map((id) => {
        const name = tagName(id)
        if (!name) return null
        return <RemovableChip key={`tag-${id}`} label={name} onRemove={() => onRemove('tags', id)} />
      })}
    </div>
  )
}
