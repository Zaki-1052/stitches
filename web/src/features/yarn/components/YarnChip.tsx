// web/src/features/yarn/components/YarnChip.tsx — the project-detail yarn chip (ADDONS §2.3,
// DESIGN §3 addition): a neutral pill — base-100 fill, base-300 border — with a tiny round
// photos[0] swatch and "{brand} · {name}" text, tapping through to /yarn/:id. Deliberately NOT
// patch-colored: the swatch shows the yarn's actual photographed color, and forcing a patch
// token here would be decoration, which DESIGN §3 forbids.
import { Link } from 'react-router'
import { thumbUrl } from '../../../lib/files.ts'
import type { YarnRecord } from '../../../lib/schema.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function YarnChip({ yarn }: { yarn: YarnRecord }) {
  const label = [yarn.brand, yarn.name].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/yarn/${yarn.id}`}
      className="flex h-11 max-w-full items-center gap-2 rounded-full border-[1.5px] bg-base-100 py-1 pr-4 pl-1.5 text-sm font-semibold"
      style={{ borderColor: 'var(--color-base-300)' }}
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
      <span className="truncate">{label}</span>
    </Link>
  )
}
