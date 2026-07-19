// importer/src/ravelry/types.ts — the slice of Ravelry's API we actually read, plus the
// extended extract contract (RAVELRY.md §4.2–§4.3, §5.1). Every remote field is optional or
// nullable: the mapper treats anything absent as "unset, never guessed". The RavelryBlock
// shape is kept in sync by hand with `web/src/features/patterns/importerClient.ts` — the same
// convention the base ExtractedMetadata already follows (no shared package between workspaces).
import type { ExtractedMetadata } from '../extract/normalize'

export type RavelryCraft = 'crochet' | 'knitting' | 'tunisian' | 'other'
export type RavelryDifficulty = 'beginner' | 'easy' | 'intermediate' | 'experienced'

export interface RavelryPhoto {
  medium2_url?: string | null
  medium_url?: string | null
  small2_url?: string | null
}

export interface RavelryNeedleSize {
  metric?: number | null
  crochet?: boolean | null
}

export interface RavelryPatternFull {
  id?: number
  name?: string | null
  permalink?: string | null
  pattern_author?: { name?: string | null } | null
  craft?: { permalink?: string | null } | null
  pattern_attributes?: Array<{ permalink?: string | null } | null> | null
  pattern_categories?: Array<{ permalink?: string | null } | null> | null
  yarn_weight?: { name?: string | null } | null
  pattern_needle_sizes?: Array<RavelryNeedleSize | null> | null
  gauge_description?: string | null
  yardage?: number | null
  yardage_max?: number | null
  difficulty_average?: number | null
  difficulty_count?: number | null
  notes_html?: string | null
  free?: boolean | null
  photos?: Array<RavelryPhoto | null> | null
}

// §4.3 — the optional block riding on the extract response; nullable except pattern_id.
export interface RavelryExtractBlock {
  pattern_id: number
  craft: RavelryCraft | null
  yarn_weight: string | null
  hook_mm: number | null
  gauge: string | null
  yardage: number | null
  yardage_max: number | null
  difficulty: RavelryDifficulty | null
  difficulty_average: number | null
  notes_html: string | null
  free: boolean | null
}

export interface RavelryExtractedMetadata extends ExtractedMetadata {
  ravelry: RavelryExtractBlock
}

// §5.1 — `patterns/search.json` list items (Pattern (list) subset) and our proxied shape.
export interface RavelrySearchListItem {
  id?: number
  name?: string | null
  permalink?: string | null
  pattern_author?: { name?: string | null } | null
  free?: boolean | null
  first_photo?: { square_url?: string | null; small_url?: string | null } | null
}

export interface RavelryPaginator {
  page: number
  page_count: number
  results: number
}

export interface RavelrySearchResult {
  pattern_id: number
  name: string | null
  permalink: string
  designer: string | null
  free: boolean
  photo: { square: string | null; small: string | null }
}
