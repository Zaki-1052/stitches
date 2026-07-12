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
export const VISIBILITIES = ['private', 'friends'] as const
export const TAG_COLORS = ['blue', 'coral', 'lilac', 'mint', 'butter'] as const

export type Craft = (typeof CRAFTS)[number]
export type YarnWeight = (typeof YARN_WEIGHTS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type Shelf = (typeof SHELVES)[number]
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

// ---- Record shapes as PB returns them (unset select = '', unset number = 0). ----

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
  created: string
  updated: string
  expand?: { tags?: TagRecord[] }
}

// Minimal projection used for the §7.9 made-✓ badge and the delete pre-check.
export interface ProjectLinkRecord {
  id: string
  pattern: string
  status: string
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
  hook_mm: numberString('Numbers only — like 5 or 5.5'),
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

export const tagFormSchema = z.object({
  name: z.string().trim().min(1, 'Name this tag').max(40, 'Keep it short'),
  color: z.enum(TAG_COLORS),
})
export type TagFormValues = z.infer<typeof tagFormSchema>
