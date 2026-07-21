// web/src/features/friends/components/FeedCard.tsx — one item in the friends feed (DESIGN §9):
// owner avatar + name lead (the feed is about people), then cover, title, context line, and a
// dated meta line — "added 12 Jul 2026" for patterns, "finished 12 Jul 2026 ☆" (mint) for
// finished objects. Taps land on the read-only detail reuse. Lists never load originals
// (SPEC §8); no cover → yarn-ball placeholder, matching ProjectCard.
import { Link } from 'react-router'
import { thumbUrl } from '../../../lib/files.ts'
import { formatShortDate } from '../../../lib/dates.ts'
import { Avatar } from '../../../components/Avatar.tsx'
import { YarnBall } from '../../../components/YarnBall.tsx'
import type { FeedItem } from '../queries.ts'

export function FeedCard({ item }: { item: FeedItem }) {
  const record = item.kind === 'pattern' ? item.pattern : item.project
  const owner = record.expand?.owner
  const to = item.kind === 'pattern' ? `/patterns/${record.id}` : `/projects/${record.id}`
  const title = item.kind === 'pattern' ? item.pattern.title : item.project.name
  const context =
    item.kind === 'pattern' ? item.pattern.designer : (item.project.expand?.pattern?.title ?? '')
  const cover = item.kind === 'pattern' ? item.pattern.thumbnail : item.project.cover

  return (
    <Link
      to={to}
      className="rounded-box flex items-center gap-3 bg-base-100 p-3"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {cover ? (
        <img
          src={thumbUrl(record, cover, 'grid')}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <span
          className="grid size-20 shrink-0 place-items-center rounded-2xl"
          style={{ background: 'var(--color-base-300)' }}
        >
          <YarnBall size={48} />
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <Avatar user={owner} className="size-6" initialClassName="text-xs" />
          <span className="truncate text-sm font-semibold">{owner?.name ?? ''}</span>
        </span>
        <span className="truncate text-lg leading-snug font-semibold">{title}</span>
        {context && (
          <span className="truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
            {context}
          </span>
        )}
        {item.kind === 'pattern' ? (
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            added {formatShortDate(item.date)}
          </span>
        ) : (
          <span className="text-xs font-semibold" style={{ color: 'var(--patch-mint-deep)' }}>
            finished {formatShortDate(item.date)} ☆
          </span>
        )}
      </span>
    </Link>
  )
}
