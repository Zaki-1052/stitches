// web/src/features/patterns/components/SearchBar.tsx — the Library's sticky search. Local state
// keeps typing zero-lag; a 300 ms debounce commits to the URL (the parent replaces, never pushes,
// so keystrokes don't pile up history entries). External URL changes (back/forward) sync back in.
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

export function SearchBar({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value)

  // Back/forward or chip-driven clears change the committed value from outside; adopt it.
  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    if (text === value) return
    const timer = window.setTimeout(() => onCommit(text), 300)
    return () => window.clearTimeout(timer)
  }, [text, value, onCommit])

  return (
    <label
      className="input input-lg flex w-full items-center gap-2"
      aria-label="Search your library"
    >
      <Search size={20} strokeWidth={2} style={{ color: 'var(--ink-muted)' }} aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        placeholder="Search titles & designers"
        className="grow"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          className="-mr-2 grid size-11 shrink-0 place-items-center"
          onClick={() => {
            setText('')
            onCommit('')
          }}
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      )}
    </label>
  )
}
