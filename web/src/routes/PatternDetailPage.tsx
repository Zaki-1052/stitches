// web/src/routes/PatternDetailPage.tsx — /patterns/:id (DESIGN §9): hero, source chip, shelf
// pill (owner-only quick mutation), meta chips, tags, sanitized notes, photo strip, attachments
// vault (owner-only), visibility toggle, delete. A friend's shared pattern renders read-only —
// no edit/delete/shelf/visibility affordances, and nothing hints at attachments (owner-only by
// rule; the card simply never mounts). The projects-on-this-pattern section waits for 2.1.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import DOMPurify from 'dompurify'
import { ExternalLink, Pencil } from 'lucide-react'
import { BackBar } from '../components/BackBar.tsx'
import { YarnBall } from '../components/YarnBall.tsx'
import { pb } from '../lib/pb.ts'
import { useAuth } from '../lib/auth.tsx'
import type { PatternRecord, Shelf, Visibility } from '../lib/schema.ts'
import { useToast } from '../features/shared/toast.tsx'
import { normalizePbError } from '../features/shared/errors.ts'
import { patchSwatch } from '../features/shared/patchColors.ts'
import { useLinkedProjects, usePattern } from '../features/patterns/queries.ts'
import { useDeletePattern, useQuickUpdatePattern } from '../features/patterns/mutations.ts'
import { MetaChips } from '../features/patterns/components/MetaChips.tsx'
import { ShelfPill } from '../features/patterns/components/ShelfPill.tsx'
import { VisibilityToggle } from '../features/patterns/components/VisibilityToggle.tsx'
import { DeleteConfirmDialog } from '../features/patterns/components/DeleteConfirmDialog.tsx'
import { AttachmentsCard } from '../features/patterns/components/AttachmentsCard.tsx'

function Frame({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar right={right} />
      {children}
    </div>
  )
}

function SourceChip({ pattern }: { pattern: PatternRecord }) {
  if (!pattern.source_url && !pattern.source_name) return null
  const label =
    pattern.source_name ||
    (() => {
      try {
        return new URL(pattern.source_url).hostname.replace(/^www\./, '')
      } catch {
        return pattern.source_url
      }
    })()
  const chipStyle = {
    background: 'var(--patch-blue-soft)',
    color: 'var(--patch-blue-deep)',
  }
  if (!pattern.source_url) {
    return (
      <span className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold" style={chipStyle}>
        {label}
      </span>
    )
  }
  return (
    <a
      href={pattern.source_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
      style={chipStyle}
    >
      {label}
      <ExternalLink size={14} strokeWidth={2.5} aria-hidden="true" />
    </a>
  )
}

export default function PatternDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const patternQuery = usePattern(id)
  const linkedQuery = useLinkedProjects(id)
  const quickUpdate = useQuickUpdatePattern()
  const deletePattern = useDeletePattern()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (patternQuery.isPending) {
    return (
      <Frame>
        <div className="grid place-items-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </Frame>
    )
  }

  if (patternQuery.isError) {
    return (
      <Frame>
        <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          That pattern couldn't be found.
        </p>
      </Frame>
    )
  }

  const pattern = patternQuery.data
  const isOwner = pattern.owner === user?.id
  const tags = pattern.expand?.tags ?? []

  const setShelf = (shelf: Shelf) => {
    if (quickUpdate.isPending) return
    quickUpdate.mutate(
      { id, body: { shelf } },
      { onError: (err) => toast(normalizePbError(err).message, 'error') },
    )
  }

  const setVisibility = (visibility: Visibility) => {
    if (quickUpdate.isPending) return
    quickUpdate.mutate(
      { id, body: { visibility } },
      { onError: (err) => toast(normalizePbError(err).message, 'error') },
    )
  }

  const handleDelete = async () => {
    try {
      await deletePattern.mutateAsync(id)
      toast('Pattern deleted.', 'success')
      navigate('/patterns', { replace: true })
    } catch (err) {
      setConfirmOpen(false)
      const normalized = normalizePbError(err)
      toast(
        normalized.status === 400
          ? "This pattern can't be deleted right now — it may still be linked somewhere you can't see."
          : normalized.message,
        'error',
      )
    }
  }

  return (
    <Frame
      right={
        isOwner ? (
          <Link
            to={`/patterns/${id}/edit`}
            aria-label="Edit pattern"
            className="btn btn-ghost btn-circle size-11"
          >
            <Pencil size={22} strokeWidth={2} />
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-10">
        {pattern.thumbnail ? (
          <img
            src={pb.files.getURL(pattern, pattern.thumbnail, { thumb: '800x0' })}
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
          <h1 className="font-display text-2xl leading-tight font-bold">{pattern.title}</h1>
          {pattern.designer && (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              by {pattern.designer}
            </p>
          )}
          <div className="mt-1">
            <SourceChip pattern={pattern} />
          </div>
        </div>

        {isOwner && <ShelfPill value={pattern.shelf || 'saved'} onChange={setShelf} />}

        <MetaChips pattern={pattern} />

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const swatch = patchSwatch(tag.color)
              return (
                <span
                  key={tag.id}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold"
                  style={{ background: swatch.soft, color: swatch.deep }}
                >
                  {tag.name}
                </span>
              )
            })}
          </div>
        )}

        {pattern.notes && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">notes</h2>
            <div
              className="rich-text rounded-box bg-base-100 px-4 py-3"
              style={{ boxShadow: 'var(--shadow-soft)' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pattern.notes) }}
            />
          </section>
        )}

        {pattern.photos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">photos</h2>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5">
              {pattern.photos.map((filename) => (
                <a
                  key={filename}
                  href={pb.files.getURL(pattern, filename)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={pb.files.getURL(pattern, filename, { thumb: '400x0' })}
                    alt=""
                    loading="lazy"
                    className="rounded-box h-40 w-auto"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {isOwner && <AttachmentsCard pattern={pattern} />}

        {isOwner && (
          <>
            <VisibilityToggle
              value={pattern.visibility}
              onChange={setVisibility}
              disabled={quickUpdate.isPending}
            />

            <button
              type="button"
              className="btn btn-outline btn-error btn-lg"
              onClick={() => setConfirmOpen(true)}
            >
              Delete pattern
            </button>
          </>
        )}
      </div>

      <DeleteConfirmDialog
        open={confirmOpen}
        linkedCount={linkedQuery.data?.length ?? 0}
        deleting={deletePattern.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </Frame>
  )
}
