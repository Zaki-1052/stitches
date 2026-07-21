// web/src/routes/YarnDetailPage.tsx — /yarn/:id (ADDONS §2.3): hero photo, meta chips,
// sanitized notes, photo strip, "used in" projects, visibility toggle, delete. Deletion is a
// quiet unlink (Zara's pick, deviates from the pattern-delete block precedent): projects that
// used the yarn keep their story, so the confirm is plain and there is no blocked branch. A
// friend's shared yarn renders read-only with the shared-by chip.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import DOMPurify from 'dompurify'
import { Pencil } from 'lucide-react'
import { BackBar } from '../components/BackBar.tsx'
import { YarnBall } from '../components/YarnBall.tsx'
import { pb } from '../lib/pb.ts'
import { thumbUrl } from '../lib/files.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Visibility } from '../lib/schema.ts'
import { CYC_LABELS } from '../lib/cyc.ts'
import { useToast } from '../features/shared/toast.tsx'
import { normalizePbError } from '../features/shared/errors.ts'
import { useYarn } from '../features/yarn/queries.ts'
import { useDeleteYarn, useQuickUpdateYarn } from '../features/yarn/mutations.ts'
import { useProjectsLinkedToYarn } from '../features/projects/queries.ts'
import { YarnUsedInList } from '../features/yarn/components/YarnUsedInList.tsx'
import { VisibilityToggle } from '../features/patterns/components/VisibilityToggle.tsx'
import { ConfirmDeleteDialog } from '../features/projects/components/ConfirmDeleteDialog.tsx'
import { SharedByChip } from '../features/friends/components/SharedByChip.tsx'

function Frame({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar right={right} />
      <div className="w-full lg:mx-auto lg:max-w-3xl">{children}</div>
    </div>
  )
}

export default function YarnDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const yarnQuery = useYarn(id)
  const usedInQuery = useProjectsLinkedToYarn(id)
  const quickUpdate = useQuickUpdateYarn()
  const deleteYarn = useDeleteYarn()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (yarnQuery.isPending) {
    return (
      <Frame>
        <div className="grid place-items-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </Frame>
    )
  }

  if (yarnQuery.isError) {
    return (
      <Frame>
        <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          That yarn couldn't be found.
        </p>
      </Frame>
    )
  }

  const yarn = yarnQuery.data
  const isOwner = yarn.owner === user?.id
  const subtitle = [yarn.brand, yarn.colorway].filter(Boolean).join(' · ')
  const usedIn = usedInQuery.data ?? []
  const metaChips = [
    yarn.weight ? CYC_LABELS[yarn.weight] : null,
    yarn.fiber || null,
    yarn.yardage_per_skein ? `${yarn.yardage_per_skein} yd per skein` : null,
    yarn.skein_count ? `${yarn.skein_count} ${yarn.skein_count === 1 ? 'skein' : 'skeins'}` : null,
  ].filter((chip): chip is string => chip !== null)

  const setVisibility = (visibility: Visibility) => {
    if (quickUpdate.isPending) return
    quickUpdate.mutate(
      { id, body: { visibility } },
      { onError: (err) => toast(normalizePbError(err).message, 'error') },
    )
  }

  const handleDelete = async () => {
    try {
      await deleteYarn.mutateAsync(id)
      toast('Yarn deleted.', 'success')
      navigate('/yarn', { replace: true })
    } catch (err) {
      setConfirmOpen(false)
      toast(normalizePbError(err).message, 'error')
    }
  }

  return (
    <Frame
      right={
        isOwner ? (
          <Link
            to={`/yarn/${id}/edit`}
            aria-label="Edit yarn"
            className="btn btn-ghost btn-circle size-11"
          >
            <Pencil size={22} strokeWidth={2} />
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-10">
        {yarn.photos.length > 0 ? (
          <img
            src={thumbUrl(yarn, yarn.photos[0], 'hero')}
            alt=""
            className="rounded-box aspect-[4/3] w-full object-cover"
            style={{ boxShadow: 'var(--shadow-soft)' }}
          />
        ) : (
          <div
            className="rounded-box grid aspect-[4/3] w-full place-items-center"
            style={{ background: 'var(--color-base-300)' }}
          >
            <YarnBall size={96} />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl leading-tight font-bold">{yarn.name}</h1>
          {subtitle && (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {!isOwner && <SharedByChip owner={yarn.expand?.owner} />}

        {metaChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex h-9 items-center rounded-full border-[1.5px] bg-base-100 px-3 text-sm font-semibold"
                style={{ borderColor: 'var(--color-base-300)' }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {yarn.notes && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">notes</h2>
            <div
              className="rich-text rounded-box bg-base-100 px-4 py-3"
              style={{ boxShadow: 'var(--shadow-soft)' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(yarn.notes) }}
            />
          </section>
        )}

        {yarn.photos.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">photos</h2>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5">
              {yarn.photos.slice(1).map((filename) => (
                <a
                  key={filename}
                  href={pb.files.getURL(yarn, filename)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={thumbUrl(yarn, filename, 'grid')}
                    alt=""
                    loading="lazy"
                    className="rounded-box h-40 w-auto"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {(isOwner || usedIn.length > 0) && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">used in</h2>
            <YarnUsedInList projects={usedIn} />
          </section>
        )}

        {isOwner && (
          <>
            <VisibilityToggle
              value={yarn.visibility}
              onChange={setVisibility}
              disabled={quickUpdate.isPending}
              helperText="Friends can see this yarn in your stash. Only you can change it."
            />

            <button
              type="button"
              className="btn btn-outline btn-error btn-lg"
              onClick={() => setConfirmOpen(true)}
            >
              Delete yarn
            </button>
          </>
        )}
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete this yarn?"
        body="Projects that used it keep their story. The yarn leaves your stash."
        confirmLabel="Delete yarn"
        deleting={deleteYarn.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </Frame>
  )
}
