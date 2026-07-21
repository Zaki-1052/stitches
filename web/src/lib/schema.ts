// web/src/lib/schema.ts — the client-side mirror of the PB schema (SPEC §12): select values,
// record shapes, and the zod form schemas. Server rules remain the real enforcement; these
// exist for form validation and typed reads. Select values are lowercase snake (SPEC §7);
// UI labels live here too, since PB stores no labels.
//
// Form number fields are strings on purpose: RHF's valueAsNumber turns an emptied input into
// NaN, and PB receives multipart strings anyway. '' means "not set"; conversion to PB's
// clear-sentinel '0' happens in the FormData builder.
import { z } from 'zod'

export const CRAFTS = ['crochet', 'knitting', 'tunisian', 'other'] as const
export const YARN_WEIGHTS = [
  'cyc_0',
  'cyc_1',
  'cyc_2',
  'cyc_3',
  'cyc_4',
  'cyc_5',
  'cyc_6',
  'cyc_7',
  'cyc_8',
] as const
export const DIFFICULTIES = ['beginner', 'easy', 'intermediate', 'experienced'] as const
export const SHELVES = ['saved', 'want_to_make', 'queued'] as const
export const PROJECT_STATUSES = [
  'planned',
  'in_progress',
  'finished',
  'frogged',
  'hibernating',
] as const
export const VISIBILITIES = ['private', 'friends'] as const
export const TAG_COLORS = ['blue', 'coral', 'lilac', 'mint', 'butter'] as const

export type Craft = (typeof CRAFTS)[number]
export type YarnWeight = (typeof YARN_WEIGHTS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type Shelf = (typeof SHELVES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type Visibility = (typeof VISIBILITIES)[number]
export type TagColor = (typeof TAG_COLORS)[number]

export const CRAFT_LABELS: Record<Craft, string> = {
  crochet: 'crochet',
  knitting: 'knitting',
  tunisian: 'tunisian',
  other: 'other',
}
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'beginner',
  easy: 'easy',
  intermediate: 'intermediate',
  experienced: 'experienced',
}
export const SHELF_LABELS: Record<Shelf, string> = {
  saved: 'saved',
  want_to_make: 'want to make',
  queued: 'queued',
}
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'planned',
  in_progress: 'in progress',
  finished: 'finished',
  frogged: 'frogged',
  hibernating: 'hibernating',
}

// ---- Record shapes as PB returns them (unset select = '', unset number = 0). ----

// Public slice of the `users` auth collection (list/view any-authed per Session 0.2; email
// stays hidden behind emailVisibility). What friends' avatars and names render from.
export interface UserRecord {
  id: string
  name: string
  avatar: string
}

export interface TagRecord {
  id: string
  owner: string
  name: string
  color: TagColor | ''
  created: string
  updated: string
}

export interface PatternRecord {
  id: string
  owner: string
  title: string
  designer: string
  source_url: string
  source_name: string
  craft: Craft | ''
  yarn_weight: YarnWeight | ''
  hook_mm: number
  gauge: string
  yardage: number
  yardage_max: number
  difficulty: Difficulty | ''
  shelf: Shelf | ''
  visibility: Visibility | ''
  tags: string[]
  thumbnail: string
  photos: string[]
  notes: string
  // Ravelry provenance (RAVELRY.md §6): 0 / '' when the pattern isn't Ravelry-sourced.
  // Written by the save form and the import script; nothing renders them in v1.
  ravelry_id: number
  ravelry_fetched_at: string
  created: string
  updated: string
  expand?: { tags?: TagRecord[]; owner?: UserRecord }
}

// Minimal projection used for the §7.9 made-✓ badge, the delete pre-check, and the
// pattern detail's projects section.
export interface ProjectLinkRecord {
  id: string
  pattern: string
  status: ProjectStatus | ''
  name: string
}

export interface ProjectRecord {
  id: string
  owner: string
  pattern: string
  name: string
  status: ProjectStatus | ''
  started_on: string
  finished_on: string
  hook_mm: number
  yarn_used: string
  summary: string
  cover: string
  visibility: Visibility | ''
  yarns: string[]
  created: string
  updated: string
  expand?: { pattern?: PatternRecord; owner?: UserRecord; yarns?: YarnRecord[] }
}

// A project's diary line (SPEC §7): visibility inherited from the project; photos time-anchored
// to the entry. `entry_date` is date-only and editable — backdating is a feature.
export interface JournalEntryRecord {
  id: string
  owner: string
  project: string
  entry_date: string
  body: string
  photos: string[]
  created: string
  updated: string
}

// Personal process, never shared (SPEC §7 counters): value is server-authoritative and only
// ever written through the outbox (`value+` deltas / sets — lib/outbox.ts); label/target/
// resets_with go through normal mutations. PB's zero values mean "not set": target 0 = no
// target, resets_with '' = stands alone. `resets_with` points at the counter whose *increment*
// resets this one to 0.
export interface CounterRecord {
  id: string
  owner: string
  project: string
  label: string
  value: number
  target: number
  resets_with: string
  created: string
  updated: string
}

// The copyright vault (SPEC §7 pattern_attachments): one record per uploaded file (label =
// original filename), plus at most one text-only record carrying pattern_text. `files` entries
// are Protected — URLs only work with a short-lived token (features/shared/protectedFiles.ts).
export interface AttachmentRecord {
  id: string
  owner: string
  pattern: string
  label: string
  files: string[]
  pattern_text: string
  created: string
  updated: string
}

// The yarn stash (ADDONS §2): patterns-shaped sharing, linked from projects as a multi-relation
// with no quantity math. Cards render photos[0] — there is no separate thumbnail field.
export interface YarnRecord {
  id: string
  owner: string
  name: string
  brand: string
  colorway: string
  weight: YarnWeight | ''
  fiber: string
  yardage_per_skein: number
  skein_count: number
  photos: string[]
  notes: string
  visibility: Visibility | ''
  created: string
  updated: string
  expand?: { owner?: UserRecord }
}

// ---- Form schemas ----

const numberString = (message: string) => z.string().regex(/^(\d+(\.\d+)?)?$/, message)

export const patternFormSchema = z.object({
  title: z.string().trim().min(1, 'Every pattern needs a name'),
  designer: z.string(),
  source_url: z.union([z.literal(''), z.url('Enter a full URL (https://…)')]),
  source_name: z.string(),
  craft: z.enum(CRAFTS),
  yarn_weight: z.union([z.literal(''), z.enum(YARN_WEIGHTS)]),
  hook_mm: numberString('Numbers only, like 5 or 5.5'),
  gauge: z.string(),
  yardage: numberString('Numbers only'),
  yardage_max: numberString('Numbers only'),
  difficulty: z.union([z.literal(''), z.enum(DIFFICULTIES)]),
  shelf: z.enum(SHELVES),
  visibility: z.enum(VISIBILITIES),
  tags: z.array(z.string()),
  notes: z.string(),
})
export type PatternFormValues = z.infer<typeof patternFormSchema>

// Display defaults (DECISIONS 2026-07-11: PB has no schema-level defaults; forms supply them).
export const patternFormDefaults: PatternFormValues = {
  title: '',
  designer: '',
  source_url: '',
  source_name: '',
  craft: 'crochet',
  yarn_weight: '',
  hook_mm: '',
  gauge: '',
  yardage: '',
  yardage_max: '',
  difficulty: '',
  shelf: 'saved',
  visibility: 'private',
  tags: [],
  notes: '',
}

// Edit mode seeds the form from a record; PB's zero values map back to "not set".
export function patternToFormValues(p: PatternRecord): PatternFormValues {
  return {
    title: p.title,
    designer: p.designer,
    source_url: p.source_url,
    source_name: p.source_name,
    craft: p.craft || 'crochet',
    yarn_weight: p.yarn_weight,
    hook_mm: p.hook_mm ? String(p.hook_mm) : '',
    gauge: p.gauge,
    yardage: p.yardage ? String(p.yardage) : '',
    yardage_max: p.yardage_max ? String(p.yardage_max) : '',
    difficulty: p.difficulty,
    shelf: p.shelf || 'saved',
    visibility: p.visibility || 'private',
    tags: p.tags ?? [],
    notes: p.notes,
  }
}

// Dates are 'YYYY-MM-DD' strings (native date-input format); conversion to PB's datetime shape
// happens in the FormData builder. `summary` is deliberately absent: the pinned summary is
// edited in place on the detail page and must never be clobbered by a form save.
export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Every project needs a name'),
  pattern: z.string(),
  status: z.enum(PROJECT_STATUSES),
  started_on: z.string(),
  finished_on: z.string(),
  hook_mm: numberString('Numbers only, like 5 or 5.5'),
  yarn_used: z.string(),
  yarns: z.array(z.string()),
  visibility: z.enum(VISIBILITIES),
})
export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const projectFormDefaults: ProjectFormValues = {
  name: '',
  pattern: '',
  status: 'planned',
  started_on: '',
  finished_on: '',
  hook_mm: '',
  yarn_used: '',
  yarns: [],
  visibility: 'private',
}

export function projectToFormValues(p: ProjectRecord): ProjectFormValues {
  return {
    name: p.name,
    pattern: p.pattern,
    status: p.status || 'planned',
    started_on: p.started_on.slice(0, 10),
    finished_on: p.finished_on.slice(0, 10),
    hook_mm: p.hook_mm ? String(p.hook_mm) : '',
    yarn_used: p.yarn_used,
    yarns: p.yarns ?? [],
    visibility: p.visibility || 'private',
  }
}

export const tagFormSchema = z.object({
  name: z.string().trim().min(1, 'Name this tag').max(40, 'Keep it short'),
  color: z.enum(TAG_COLORS),
})
export type TagFormValues = z.infer<typeof tagFormSchema>

export const yarnFormSchema = z.object({
  name: z.string().trim().min(1, 'Every yarn needs a name'),
  brand: z.string(),
  colorway: z.string(),
  weight: z.union([z.literal(''), z.enum(YARN_WEIGHTS)]),
  fiber: z.string(),
  yardage_per_skein: numberString('Numbers only'),
  skein_count: numberString('Numbers only'),
  notes: z.string(),
  visibility: z.enum(VISIBILITIES),
})
export type YarnFormValues = z.infer<typeof yarnFormSchema>

export const yarnFormDefaults: YarnFormValues = {
  name: '',
  brand: '',
  colorway: '',
  weight: '',
  fiber: '',
  yardage_per_skein: '',
  skein_count: '',
  notes: '',
  visibility: 'private',
}

export function yarnToFormValues(y: YarnRecord): YarnFormValues {
  return {
    name: y.name,
    brand: y.brand,
    colorway: y.colorway,
    weight: y.weight,
    fiber: y.fiber,
    yardage_per_skein: y.yardage_per_skein ? String(y.yardage_per_skein) : '',
    skein_count: y.skein_count ? String(y.skein_count) : '',
    notes: y.notes,
    visibility: y.visibility || 'private',
  }
}
