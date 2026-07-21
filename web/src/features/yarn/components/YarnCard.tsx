// web/src/features/yarn/components/YarnCard.tsx — one yarn in the stash grid (ADDONS §2.3):
// photos[0] at ?thumb=400x0 (or the yarn-ball placeholder — no separate thumbnail field exists),
// name, brand · colorway, CYC weight label. Single grid variant; the stash has no list view.
import { Link } from 'react-router'
import { thumbUrl } from '../../../lib/files.ts'
import type { YarnRecord } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function YarnCard({ yarn }: { yarn: YarnRecord }) {
  const subtitle = [yarn.brand, yarn.colorway].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/yarn/${yarn.id}`}
      className="rounded-box block overflow-hidden bg-base-100"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {yarn.photos.length > 0 ? (
        <img
          src={thumbUrl(yarn, yarn.photos[0], 'grid')}
          alt=""
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
        />
      ) : (
        <div
          className="grid aspect-[4/5] w-full place-items-center"
          style={{ background: 'var(--color-base-300)' }}
        >
          <YarnBall size={56} />
        </div>
      )}
      <span className="block p-3">
        <span className="block truncate text-lg leading-snug font-semibold">{yarn.name}</span>
        {subtitle && (
          <span className="block truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
            {subtitle}
          </span>
        )}
        {yarn.weight && (
          <span
            className="mt-1.5 block truncate text-xs font-semibold"
            style={{ color: 'var(--ink-muted)' }}
          >
            {CYC_LABELS[yarn.weight]}
          </span>
        )}
      </span>
    </Link>
  )
}
