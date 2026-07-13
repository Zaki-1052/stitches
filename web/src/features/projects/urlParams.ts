// web/src/features/projects/urlParams.ts — /projects carries one optional status filter in the
// URL (?status=in_progress), same defensive conventions as the Library's params: unknown values
// from stale bookmarks parse to "no filter", and only non-defaults land in the URL so a pristine
// list is plain /projects.
import { PROJECT_STATUSES } from '../../lib/schema.ts'
import type { ProjectStatus } from '../../lib/schema.ts'

export interface ProjectsParams {
  status: ProjectStatus | null
}

export function parseProjectsParams(searchParams: URLSearchParams): ProjectsParams {
  const raw = searchParams.get('status')
  const status = (PROJECT_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as ProjectStatus)
    : null
  return { status }
}

export function serializeProjectsParams({ status }: ProjectsParams): URLSearchParams {
  const out = new URLSearchParams()
  if (status) out.set('status', status)
  return out
}
