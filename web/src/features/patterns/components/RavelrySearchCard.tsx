// web/src/features/patterns/components/RavelrySearchCard.tsx — one Ravelry search result
// (RAVELRY.md §5.2): square thumb, name, designer, mint "free" pill. A <button>, not a <Link> —
// tapping runs the enrichment import, it doesn't navigate by URL. The thumbnail renders
// directly from Ravelry's CDN (transient browsing, nothing stored); only a picked pattern's
// image enters the §8 pipeline, and that happens in useUrlImport, not here. Visual language
// mirrors PatternCard's grid variant; no-photo results get the yarn-ball placeholder.
import { YarnBall } from '../../../components/YarnBall.tsx'
import type { RavelrySearchResult } from '../importerClient.ts'

export function RavelrySearchCard({
  result,
  importing,
  disabled,
  onPick,
}: {
  result: RavelrySearchResult
  importing: boolean
  disabled: boolean
  onPick: () => void
}) {
  // small_url (240 px) over square_url (75 px): both are square-ish crops, but 75 px smears on
  // a two-column grid card.
  const photo = result.photo.small ?? result.photo.square

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="rounded-box block overflow-hidden bg-base-100 text-left"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <span className="relative block">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="aspect-square w-full object-cover" />
        ) : (
          <span
            className="grid aspect-square w-full place-items-center"
            style={{ background: 'var(--color-base-300)' }}
          >
            <YarnBall size={56} />
          </span>
        )}
        {importing && (
          <span className="absolute inset-0">
            <span className="absolute inset-0 bg-base-100 opacity-70" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="loading loading-spinner" />
            </span>
          </span>
        )}
      </span>
      <span className="block p-3">
        <span className="block truncate text-lg leading-snug font-semibold">
          {result.name ?? 'Untitled pattern'}
        </span>
        <span className="mt-0.5 flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
            {result.designer ?? ''}
          </span>
          {result.free && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: 'var(--patch-mint-soft)', color: 'var(--patch-mint-deep)' }}
            >
              free
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
