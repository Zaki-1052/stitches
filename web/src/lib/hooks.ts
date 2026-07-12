// web/src/lib/hooks.ts — crochet hook sizes: metric mm is authoritative, US letters are display
// aliases only (SPEC §7). The 13 core rows come verbatim from DESIGN §9; an off-table mm shows
// plain "4.5 mm" with no guessed alias. (The DESIGN-mandated filename predates React connotations —
// nothing in here is a React hook.)

export const HOOK_ALIASES: ReadonlyArray<{ mm: number; us: string }> = [
  { mm: 2.25, us: 'B-1' },
  { mm: 2.75, us: 'C-2' },
  { mm: 3.25, us: 'D-3' },
  { mm: 3.5, us: 'E-4' },
  { mm: 3.75, us: 'F-5' },
  { mm: 4.0, us: 'G-6' },
  { mm: 5.0, us: 'H-8' },
  { mm: 5.5, us: 'I-9' },
  { mm: 6.0, us: 'J-10' },
  { mm: 6.5, us: 'K-10½' },
  { mm: 8.0, us: 'L-11' },
  { mm: 9.0, us: 'M/N-13' },
  { mm: 10.0, us: 'N/P-15' },
]

export function usAlias(mm: number): string | null {
  return HOOK_ALIASES.find((row) => row.mm === mm)?.us ?? null
}

// Whole numbers keep one decimal ("5.0 mm") to match DESIGN's rendering; 2.25 stays 2.25.
function formatMm(mm: number): string {
  return Number.isInteger(mm) ? mm.toFixed(1) : String(mm)
}

// "5.0 mm · H-8" when aliased, "4.5 mm" when not.
export function formatHook(mm: number): string {
  const alias = usAlias(mm)
  return alias ? `${formatMm(mm)} mm · ${alias}` : `${formatMm(mm)} mm`
}
