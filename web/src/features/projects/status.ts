// web/src/features/projects/status.ts — status → patch-color semantics (DESIGN §3): planned
// dreams in lilac, in-progress is "on the hook" blue, finished is gentle mint, frogged is warm
// coral (never error-red), hibernating naps in butter. Lives outside the component files so
// react-refresh stays happy and non-component code (pages, cards) can share it.
import type { ProjectStatus, TagColor } from '../../lib/schema.ts'

export const STATUS_PATCH: Record<ProjectStatus, TagColor> = {
  planned: 'lilac',
  in_progress: 'blue',
  finished: 'mint',
  frogged: 'coral',
  hibernating: 'butter',
}

// PB has no schema defaults, so a record saved without a status reads as planned (the form
// default) rather than crashing a chip.
export function normalizeStatus(status: ProjectStatus | ''): ProjectStatus {
  return status || 'planned'
}
