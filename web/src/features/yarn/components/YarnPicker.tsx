// web/src/features/yarn/components/YarnPicker.tsx — the project form's yarn multi-select
// (ADDONS §2.3), following the TagPicker toggle-chip idiom rather than the pattern link's
// single <select>: candidates mirror the shipped link guard (own-only since 2026-07-20 —
// useYarnOptions), each chip a photo swatch + brand/name. No inline create — yarn entry is a
// full form, so the ghost pill points at /yarn/new instead.
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { thumbUrl } from '../../../lib/files.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'
import { useYarnOptions } from '../queries.ts'

export function YarnPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const optionsQuery = useYarnOptions()

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(optionsQuery.data ?? []).map((yarn) => {
        const selected = value.includes(yarn.id)
        const label = [yarn.brand, yarn.name].filter(Boolean).join(' · ')
        return (
          <button
            key={yarn.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(yarn.id)}
            className="flex h-11 items-center gap-2 rounded-full border-[1.5px] py-1 pr-4 pl-1.5 text-sm font-semibold"
            style={
              selected
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
            }
          >
            {yarn.photos.length > 0 ? (
              <img
                src={thumbUrl(yarn, yarn.photos[0], 'chip')}
                alt=""
                loading="lazy"
                className="size-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full"
                style={{ background: 'var(--color-base-300)' }}
              >
                <YarnBall size={20} />
              </span>
            )}
            <span className="max-w-40 truncate">{label}</span>
          </button>
        )
      })}

      <Link
        to="/yarn/new"
        className="flex h-11 items-center gap-1 rounded-full border-2 border-dashed px-4 text-sm font-semibold"
        style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
      >
        <Plus size={16} strokeWidth={2.5} />
        add yarn
      </Link>
    </div>
  )
}
