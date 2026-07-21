// web/src/routes/ProjectDetailPage.tsx — /projects/:id (DESIGN §9): cover, status chip → status
// sheet, pinned summary (edit in place), journal feed, visibility, delete. The finished flip is
// the celebration moment: confetti (once, from the mutation callback — StrictMode double-invokes
// effects, not mutation callbacks), finished_on defaulting only-if-empty, then the finished-photo
// prompt. Reduced motion skips straight to the prompt; the status update is optimistic either
// way. The counters card and its realtime subscription are owner-only (SPEC §7/§11).
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Pencil } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { BackBar } from '../components/BackBar.tsx'
import { YarnBall } from '../components/YarnBall.tsx'
import { thumbUrl } from '../lib/files.ts'
import { useAuth } from '../lib/auth.tsx'
import type { ProjectStatus, Visibility } from '../lib/schema.ts'
import { formatShortDate, todayLocalISO, toPbDate } from '../lib/dates.ts'
import { formatHook } from '../lib/hooks.ts'
import { useToast } from '../features/shared/toast.tsx'
import { normalizePbError } from '../features/shared/errors.ts'
import { useProject } from '../features/projects/queries.ts'
import { useDeleteProject, useQuickUpdateProject } from '../features/projects/mutations.ts'
import { normalizeStatus } from '../features/projects/status.ts'
import { StatusChip } from '../features/projects/components/StatusChip.tsx'
import { StatusSheet } from '../features/projects/components/StatusSheet.tsx'
import { StarConfetti } from '../features/projects/components/StarConfetti.tsx'
import { FinishedPromptDialog } from '../features/projects/components/FinishedPromptDialog.tsx'
import { SummaryCard } from '../features/projects/components/SummaryCard.tsx'
import { JournalFeed } from '../features/projects/components/JournalFeed.tsx'
import { CountersCard } from '../features/counters/components/CountersCard.tsx'
import { useCountersRealtime } from '../features/counters/realtime.ts'
import { ConfirmDeleteDialog } from '../features/projects/components/ConfirmDeleteDialog.tsx'
import { VisibilityToggle } from '../features/patterns/components/VisibilityToggle.tsx'
import { SharedByChip } from '../features/friends/components/SharedByChip.tsx'
import { YarnChip } from '../features/yarn/components/YarnChip.tsx'

function Frame({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar right={right} />
      <div className="w-full lg:mx-auto lg:max-w-3xl">{children}</div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const projectQuery = useProject(id)
  const quickUpdate = useQuickUpdateProject()
  const deleteProject = useDeleteProject()
  // SPEC §11: counters realtime, subscribed per open project — owners only. A viewer's
  // subscription would be rule-filtered to silence anyway; don't open the SSE topic at all.
  // (The `user &&` guard keeps undefined === undefined from passing while the project loads.)
  useCountersRealtime(user && projectQuery.data?.owner === user.id ? id : '')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (projectQuery.isPending) {
    return (
      <Frame>
        <div className="grid place-items-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </Frame>
    )
  }

  if (projectQuery.isError) {
    return (
      <Frame>
        <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          That project couldn't be found.
        </p>
      </Frame>
    )
  }

  const project = projectQuery.data
  const isOwner = project.owner === user?.id
  const status = normalizeStatus(project.status)
  const linkedPattern = project.expand?.pattern

  const pickStatus = (next: ProjectStatus) => {
    if (quickUpdate.isPending) return
    setSheetOpen(false)
    const wasFinished = status === 'finished'
    const body: Parameters<typeof quickUpdate.mutate>[0]['body'] = { status: next }
    // Only-if-empty: re-finishing later must not rewrite the original finish date.
    if (next === 'finished' && !project.finished_on) body.finished_on = toPbDate(todayLocalISO())
    quickUpdate.mutate(
      { id, body },
      {
        onSuccess: () => {
          if (next !== 'finished' || wasFinished) return
          if (reducedMotion) setPromptOpen(true)
          else setCelebrating(true)
        },
        onError: (err) => toast(normalizePbError(err).message, 'error'),
      },
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
      await deleteProject.mutateAsync(id)
      toast('Project deleted.', 'success')
      navigate('/projects', { replace: true })
    } catch (err) {
      setConfirmOpen(false)
      toast(normalizePbError(err).message, 'error')
    }
  }

  const metaChips: string[] = []
  if (project.hook_mm) metaChips.push(formatHook(project.hook_mm))
  if (project.yarn_used) metaChips.push(project.yarn_used)
  if (project.started_on) metaChips.push(`started ${formatShortDate(project.started_on)}`)
  if (project.finished_on) metaChips.push(`finished ${formatShortDate(project.finished_on)}`)

  return (
    <Frame
      right={
        isOwner ? (
          <Link
            to={`/projects/${id}/edit`}
            aria-label="Edit project"
            className="btn btn-ghost btn-circle size-11"
          >
            <Pencil size={22} strokeWidth={2} />
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-10">
        {project.cover ? (
          <img
            src={thumbUrl(project, project.cover, 'hero')}
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

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl leading-tight font-bold">{project.name}</h1>
          {linkedPattern && (
            <div>
              <Link
                to={`/patterns/${linkedPattern.id}`}
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold"
                style={{
                  background: 'var(--patch-blue-soft)',
                  color: 'var(--patch-blue-deep)',
                }}
              >
                {linkedPattern.title}
              </Link>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status={project.status}
              onPress={isOwner ? () => setSheetOpen(true) : undefined}
            />
            {status === 'frogged' && (
              <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                Frogged — rip-it happens.
              </span>
            )}
          </div>
          {!isOwner && <SharedByChip owner={project.expand?.owner} />}
        </div>

        {metaChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaChips.map((label) => (
              <span
                key={label}
                className="rounded-full border-[1.5px] bg-base-100 px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: 'var(--color-base-300)' }}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {(project.expand?.yarns?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.expand!.yarns!.map((yarn) => (
              <YarnChip key={yarn.id} yarn={yarn} />
            ))}
          </div>
        )}

        <SummaryCard project={project} isOwner={isOwner} />

        <CountersCard project={project} isOwner={isOwner} />

        <JournalFeed
          project={project}
          isOwner={isOwner}
          composerOpen={composerOpen}
          onComposerOpenChange={setComposerOpen}
        />

        {isOwner && (
          <>
            <VisibilityToggle
              value={project.visibility}
              onChange={setVisibility}
              disabled={quickUpdate.isPending}
              helperText="Friends can see this project and its journal — counters stay yours."
            />

            <button
              type="button"
              className="btn btn-outline btn-error btn-lg"
              onClick={() => setConfirmOpen(true)}
            >
              Delete project
            </button>
          </>
        )}
      </div>

      <StatusSheet
        open={sheetOpen}
        current={status}
        pending={quickUpdate.isPending}
        onPick={pickStatus}
        onClose={() => setSheetOpen(false)}
      />

      {celebrating && (
        <StarConfetti
          onComplete={() => {
            setCelebrating(false)
            setPromptOpen(true)
          }}
        />
      )}

      <FinishedPromptDialog
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        onAddPhoto={() => {
          setPromptOpen(false)
          setComposerOpen(true)
        }}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete this project?"
        body="Delete this project and its journal? This can't be undone."
        confirmLabel="Delete project"
        deleting={deleteProject.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </Frame>
  )
}
