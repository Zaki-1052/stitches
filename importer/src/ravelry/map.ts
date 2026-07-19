// importer/src/ravelry/map.ts — Ravelry vocabulary → Stitches vocabulary, server-side, so the
// client stays dumb (RAVELRY.md §4.2 verbatim). Pure functions; anything unknown or absent
// maps to null, never a guess. Every remote string is trimmed — live responses carry trailing
// whitespace ("stockinette stitch  ", §9 live notes).
import type {
  RavelryCraft,
  RavelryDifficulty,
  RavelryExtractBlock,
  RavelryExtractedMetadata,
  RavelryNeedleSize,
  RavelryPatternFull,
  RavelrySearchListItem,
  RavelrySearchResult,
} from './types'

const RAVELRY_LIBRARY_BASE = 'https://www.ravelry.com/patterns/library/'

// Ravelry's official weight chart → CYC. cyc_8 "Jumbo+" has no Ravelry equivalent; names not
// in this table stay unset.
export const YARN_WEIGHT_TO_CYC: Record<string, string> = {
  Thread: 'cyc_0',
  Cobweb: 'cyc_0',
  Lace: 'cyc_0',
  'Light Fingering': 'cyc_0',
  Fingering: 'cyc_1',
  Sport: 'cyc_2',
  DK: 'cyc_3',
  Worsted: 'cyc_4',
  Aran: 'cyc_4',
  Bulky: 'cyc_5',
  'Super Bulky': 'cyc_6',
  Jumbo: 'cyc_7',
}

// difficulty_average buckets — values cluster 1.5–3 in the wild (1.595 over 6,099 ratings on
// the smoke-test pattern); tune freely, it's one constant.
export const DIFFICULTY_THRESHOLDS = { beginner: 2.0, easy: 3.0, intermediate: 4.5 } as const

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function intOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Tunisian first: Ravelry files Tunisian patterns under craft=crochet, with the distinction
// living in attributes/categories.
function mapCraft(pattern: RavelryPatternFull): RavelryCraft {
  const facets = [...(pattern.pattern_attributes ?? []), ...(pattern.pattern_categories ?? [])]
  if (facets.some((facet) => facet?.permalink?.includes('tunisian'))) return 'tunisian'
  const permalink = pattern.craft?.permalink
  if (permalink === 'crochet' || permalink === 'knitting') return permalink
  return 'other'
}

// Entries with crochet === true only; `metric` is the mm value. `hook` is null even on crochet
// entries and `us` is knitting-scale numbering — both ignored (verified live 2026-07-17).
// Several hooks → smallest.
function mapHookMm(sizes: Array<RavelryNeedleSize | null> | null | undefined): number | null {
  const metrics = (sizes ?? [])
    .filter((size) => size?.crochet === true)
    .map((size) => size?.metric)
    .filter((metric): metric is number => typeof metric === 'number' && Number.isFinite(metric))
  return metrics.length ? Math.min(...metrics) : null
}

// A falsy rating count (0 OR null — both seen live) means the average is meaningless noise;
// both bucket and raw average stay unset.
function mapDifficulty(
  average: number | null | undefined,
  count: number | null | undefined,
): RavelryDifficulty | null {
  if (!count || typeof average !== 'number') return null
  if (average <= DIFFICULTY_THRESHOLDS.beginner) return 'beginner'
  if (average <= DIFFICULTY_THRESHOLDS.easy) return 'easy'
  if (average <= DIFFICULTY_THRESHOLDS.intermediate) return 'intermediate'
  return 'experienced'
}

function mapPhoto(pattern: RavelryPatternFull): string | null {
  const photo = pattern.photos?.[0]
  return textOrNull(photo?.medium2_url) ?? textOrNull(photo?.medium_url) ?? textOrNull(photo?.small2_url)
}

export function mapPatternToExtended(pattern: RavelryPatternFull): RavelryExtractedMetadata {
  if (typeof pattern.id !== 'number') throw new Error('Ravelry pattern response is missing its id')
  const permalink = textOrNull(pattern.permalink)
  if (!permalink) throw new Error('Ravelry pattern response is missing its permalink')

  // The canonical pattern page — NOT the object's `url` field, which is the designer's own
  // external site (§4.2).
  const sourceUrl = `${RAVELRY_LIBRARY_BASE}${permalink}`
  const difficulty = mapDifficulty(pattern.difficulty_average, pattern.difficulty_count)

  const ravelry: RavelryExtractBlock = {
    pattern_id: pattern.id,
    craft: mapCraft(pattern),
    yarn_weight: YARN_WEIGHT_TO_CYC[textOrNull(pattern.yarn_weight?.name) ?? ''] ?? null,
    hook_mm: mapHookMm(pattern.pattern_needle_sizes),
    gauge: textOrNull(pattern.gauge_description),
    yardage: intOrNull(pattern.yardage),
    yardage_max: intOrNull(pattern.yardage_max),
    difficulty,
    difficulty_average: difficulty !== null ? intOrNull(pattern.difficulty_average) : null,
    notes_html: textOrNull(pattern.notes_html),
    free: typeof pattern.free === 'boolean' ? pattern.free : null,
  }

  return {
    source_url: sourceUrl,
    canonical_url: sourceUrl,
    title: textOrNull(pattern.name),
    // Nothing in the Pattern object maps cleanly to a one-line description; the real prose
    // rides in ravelry.notes_html. site_name stays null so the client's hostLabel fallback
    // renders the chip as "imported from ravelry.com" unchanged (§4.3).
    description: null,
    image: mapPhoto(pattern),
    site_name: null,
    author: textOrNull(pattern.pattern_author?.name),
    ravelry,
  }
}

// Search list items missing an id or permalink can't be tapped into the enrichment path —
// the route drops them (return null) rather than sending the client a dead card.
export function mapSearchResult(item: RavelrySearchListItem): RavelrySearchResult | null {
  if (typeof item.id !== 'number') return null
  const permalink = textOrNull(item.permalink)
  if (!permalink) return null
  return {
    pattern_id: item.id,
    name: textOrNull(item.name),
    permalink,
    designer: textOrNull(item.pattern_author?.name),
    free: item.free === true,
    photo: {
      square: textOrNull(item.first_photo?.square_url),
      small: textOrNull(item.first_photo?.small_url),
    },
  }
}
