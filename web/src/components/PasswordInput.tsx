// web/src/components/PasswordInput.tsx — password field with a show/hide (eye) toggle. Same
// DaisyUI wrapper idiom as SearchBar: the wrapper carries the input styling, the bare input
// grows inside it, and the 44 px toggle button tucks into the field padding. Each instance
// owns its visibility state, so peeking one field never reveals its neighbours.
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type' | 'className'>) {
  const [show, setShow] = useState(false)

  return (
    <div className="input input-lg flex w-full items-center gap-2">
      <input type={show ? 'text' : 'password'} className="grow" {...props} />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        className="-mr-2 grid size-11 shrink-0 place-items-center"
        // Keep focus (and the iOS keyboard) in the input while peeking.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((v) => !v)}
      >
        {show ? (
          <EyeOff size={20} strokeWidth={2} style={{ color: 'var(--ink-muted)' }} />
        ) : (
          <Eye size={20} strokeWidth={2} style={{ color: 'var(--ink-muted)' }} />
        )}
      </button>
    </div>
  )
}
