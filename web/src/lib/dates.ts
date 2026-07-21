// web/src/lib/dates.ts — helpers for PB `date` fields, which round-trip as
// "YYYY-MM-DD 00:00:00.000Z". Rule: never parse a PB date string through `new Date()` for
// display — UTC midnight rendered in a negative-offset timezone shifts the calendar day
// backward. All values here are date-only UTC-midnight strings, so slicing is exact and
// lexical sort on them is chronological.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Today as 'YYYY-MM-DD' in the *local* timezone — the default for date inputs. (Building this
// from toISOString() would hand an evening user tomorrow's date.)
export function todayLocalISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// PB date string → <input type="date"> value.
export function toDateInputValue(pbDate: string): string {
  return pbDate.slice(0, 10)
}

// <input type="date"> value → PB date string; '' passes through as PB's clear signal.
export function toPbDate(inputValue: string): string {
  return inputValue ? `${inputValue} 00:00:00.000Z` : ''
}

// PB date string → "12 Jul 2026" for cards, meta lines, and feed group headers.
export function formatShortDate(pbDate: string): string {
  if (!pbDate) return ''
  const [year, month, day] = pbDate.slice(0, 10).split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}

// Relative stamp for the Settings OfflineCard's "Last synced" line. Takes a full ISO datetime
// (client-minted, lib/sync.ts) — NOT a PB date-only string, so `new Date()` is safe here.
export function formatRelativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`
}
