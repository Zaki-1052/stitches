// web/src/features/yarn/components/YarnUsedInList.tsx — the yarn detail's "used in" body
// (ADDONS §2.3): viewer-visible projects linking this yarn, StatusChip rows mirroring the
// pattern detail's projects list. Purely presentational; the reverse query lives in
// features/projects/queries.ts (useProjectsLinkedToYarn).
import { Link } from 'react-router'
import type { ProjectLinkRecord } from '../../../lib/schema.ts'
import { StatusChip } from '../../projects/components/StatusChip.tsx'

export function YarnUsedInList({ projects }: { projects: ProjectLinkRecord[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Not in a project yet.
      </p>
    )
  }
  return (
    <div
      className="rounded-box flex flex-col bg-base-100 px-4 py-1"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {projects.map((linked) => (
        <Link
          key={linked.id}
          to={`/projects/${linked.id}`}
          className="flex min-h-12 items-center justify-between gap-3"
        >
          <span className="min-w-0 flex-1 truncate font-semibold">{linked.name}</span>
          <StatusChip status={linked.status} />
        </Link>
      ))}
    </div>
  )
}
