// web/src/features/patterns/components/PatternCard.tsx — one pattern in the Library, grid and
// list variants (DESIGN §9). Grid: 4:5 thumbnail (?thumb=400x0), title, designer, tag dots, mint
// "made ✓" when a visible finished project exists (§7.9). Lists never load originals (SPEC §8);
// a pattern without a photo gets the yarn-ball placeholder instead of a broken image.
import { Link } from 'react-router'
import { pb } from '../../../lib/pb.ts'
import type { PatternRecord } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'
import type { LibraryView } from '../urlParams.ts'

function Thumbnail({
  pattern,
  thumb,
  className,
  placeholderSize,
}: {
  pattern: PatternRecord
  thumb: string
  className: string
  placeholderSize: number
}) {
  if (pattern.thumbnail) {
    return (
      <img
        src={pb.files.getURL(pattern, pattern.thumbnail, { thumb })}
        alt=""
        loading="lazy"
        className={`${className} object-cover`}
      />
    )
  }
  return (
    <div
      className={`${className} grid place-items-center`}
      style={{ background: 'var(--color-base-300)' }}
    >
      <YarnBall size={placeholderSize} />
    </div>
  )
}

function TagDots({ pattern }: { pattern: PatternRecord }) {
  const tags = pattern.expand?.tags ?? []
  if (tags.length === 0) return null
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {tags.slice(0, 5).map((tag) => (
        <span
          key={tag.id}
          className="size-2.5 rounded-full"
          style={{ background: patchSwatch(tag.color).core }}
        />
      ))}
    </span>
  )
}

function MadeBadge() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ background: 'var(--patch-mint-soft)', color: 'var(--patch-mint-deep)' }}
    >
      made ✓
    </span>
  )
}

export function PatternCard({
  pattern,
  made,
  view,
}: {
  pattern: PatternRecord
  made: boolean
  view: LibraryView
}) {
  if (view === 'list') {
    return (
      <Link
        to={`/patterns/${pattern.id}`}
        className="rounded-box flex items-center gap-3 bg-base-100 p-2"
        style={{ boxShadow: 'var(--shadow-soft)' }}
      >
        <Thumbnail
          pattern={pattern}
          thumb="100x100"
          className="size-14 shrink-0 rounded-2xl"
          placeholderSize={36}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{pattern.title}</span>
          {pattern.designer && (
            <span className="block truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
              {pattern.designer}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 pr-1">
          <TagDots pattern={pattern} />
          {made && <MadeBadge />}
        </span>
      </Link>
    )
  }

  return (
    <Link
      to={`/patterns/${pattern.id}`}
      className="rounded-box block overflow-hidden bg-base-100"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <Thumbnail
        pattern={pattern}
        thumb="400x0"
        className="aspect-[4/5] w-full"
        placeholderSize={56}
      />
      <span className="block p-3">
        <span className="block truncate text-lg leading-snug font-semibold">{pattern.title}</span>
        {pattern.designer && (
          <span className="block truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
            {pattern.designer}
          </span>
        )}
        <span className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
          <TagDots pattern={pattern} />
          {made && <MadeBadge />}
        </span>
      </span>
    </Link>
  )
}
