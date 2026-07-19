// web/src/routes/RavelrySearchPage.tsx — the Search Ravelry door's screen (RAVELRY.md §5.2):
// a dockless pushed subpage (BackBar pattern) with a search box, result cards straight off
// Ravelry's CDN, and "more results" paging. Search commits on submit (Enter / the keyboard's
// Search key), NOT on a debounce — every request rides the importer's shared per-user rate
// budget, so keystroke-searching would starve the import doors. Tapping a card runs the exact
// paste-a-link enrichment path by permalink (useUrlImport), landing on the pre-filled save
// form. The disclosure line is the license's conspicuous-use notice (RAVELRY.md §3 #4).
import { useRef, useState } from 'react'
import { Search, SearchX } from 'lucide-react'
import { BackBar } from '../components/BackBar.tsx'
import { useToast } from '../features/shared/toast.tsx'
import { ImporterError, searchRavelry } from '../features/patterns/importerClient.ts'
import type { RavelrySearchResult } from '../features/patterns/importerClient.ts'
import { useUrlImport } from '../features/patterns/useUrlImport.ts'
import { RavelrySearchCard } from '../features/patterns/components/RavelrySearchCard.tsx'

const MSG_SEARCH_FAIL = "Ravelry didn't answer. Try again in a moment?"
const MSG_SEARCH_RATE_LIMITED = "That's a lot of searching at once. Give it a minute?"
const MSG_IMPORT_RATE_LIMITED = "That's a lot at once. Give it a minute, then tap it again."
const MSG_EMPTY = 'Nothing turned up. Try different words?'
const DISCLOSURE = 'Results come straight from Ravelry. Stitches only keeps the ones you save.'

const RAVELRY_LIBRARY_BASE = 'https://www.ravelry.com/patterns/library/'

interface Paginator {
  page: number
  page_count: number
  results: number
}

export default function RavelrySearchPage() {
  const { run } = useUrlImport()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [results, setResults] = useState<RavelrySearchResult[]>([])
  const [paginator, setPaginator] = useState<Paginator | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [importingId, setImportingId] = useState<number | null>(null)

  const runSearch = async (q: string, page: number, append: boolean) => {
    try {
      const res = await searchRavelry(q, page)
      setResults((prev) => (append ? [...prev, ...res.results] : res.results))
      setPaginator(res.paginator)
    } catch (err) {
      console.warn('[ravelry-search] search failed', err)
      const code = err instanceof ImporterError ? err.code : ''
      setError(code === 'rate_limited' ? MSG_SEARCH_RATE_LIMITED : MSG_SEARCH_FAIL)
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q || searching) return
    inputRef.current?.blur() // drop the iOS keyboard so the results are visible
    setSubmitted(q)
    setError('')
    setResults([])
    setPaginator(null)
    setSearching(true)
    void runSearch(q, 1, false).finally(() => setSearching(false))
  }

  const canLoadMore = paginator !== null && paginator.page < paginator.page_count
  const onMore = () => {
    if (!canLoadMore || loadingMore || !submitted || paginator === null) return
    setError('')
    setLoadingMore(true)
    void runSearch(submitted, paginator.page + 1, true).finally(() => setLoadingMore(false))
  }

  // One import at a time: the tapped card shows a spinner, every card disables. useUrlImport
  // navigates to the pre-filled form itself. Rate-limited stays HERE with a toast — the card
  // is still on screen to re-tap in a minute. Any other extract failure still opens the form,
  // seeded from the card (title/designer/source) so it never lands blank.
  const onPick = (result: RavelrySearchResult) => {
    if (importingId !== null) return
    setImportingId(result.pattern_id)
    void run(`${RAVELRY_LIBRARY_BASE}${result.permalink}`, {
      title: result.name ?? '',
      designer: result.designer ?? '',
      source_name: 'Ravelry',
    })
      .then((outcome) => {
        if (outcome === 'rate_limited') toast(MSG_IMPORT_RATE_LIMITED, 'info')
      })
      .finally(() => setImportingId(null))
  }

  const showEmpty =
    !searching && !error && paginator !== null && paginator.results === 0 && results.length === 0

  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title="search ravelry" />
      <div className="w-full lg:mx-auto lg:max-w-3xl">
        <div className="flex flex-col gap-4 px-5 pb-8">
          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <label className="input input-lg flex w-full items-center gap-2" aria-label="Search Ravelry">
              <Search
                size={20}
                strokeWidth={2}
                style={{ color: 'var(--ink-muted)' }}
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                placeholder="granny square, bee, cardigan…"
                className="grow"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {DISCLOSURE}
            </p>
          </form>

          {searching && (
            <div className="grid place-items-center py-14">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}

          {error && (
            <p className="px-5 py-10 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              {error}
            </p>
          )}

          {showEmpty && (
            <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
              <SearchX
                size={48}
                strokeWidth={2}
                style={{ color: 'var(--ink-muted)' }}
                aria-hidden="true"
              />
              <p className="font-display max-w-60 text-xl font-bold">{MSG_EMPTY}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map((result) => (
                <RavelrySearchCard
                  key={result.pattern_id}
                  result={result}
                  importing={importingId === result.pattern_id}
                  disabled={importingId !== null}
                  onPick={() => onPick(result)}
                />
              ))}
            </div>
          )}

          {results.length > 0 && canLoadMore && (
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              disabled={loadingMore || importingId !== null}
              onClick={onMore}
            >
              {loadingMore ? <span className="loading loading-spinner" /> : 'more results'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
