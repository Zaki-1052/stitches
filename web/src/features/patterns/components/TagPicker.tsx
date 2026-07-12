// web/src/features/patterns/components/TagPicker.tsx — tag selection + inline creation (PLAN 1.2).
// Chip anatomy per DESIGN §3: soft fill + deep text; selected flips to core fill + espresso ink.
// The inline mini-form (name + five patch swatches) creates the tag immediately and selects it;
// a (owner,name) unique-index violation stays inline with the input preserved for editing.
import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { TAG_COLORS, tagFormSchema } from '../../../lib/schema.ts'
import type { TagColor } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { normalizePbError } from '../../shared/errors.ts'
import { useTags } from '../queries.ts'
import { useCreateTag } from '../mutations.ts'

export function TagPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const tagsQuery = useTags()
  const createTag = useCreateTag()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<TagColor>('blue')
  const [createError, setCreateError] = useState('')

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const submitNewTag = async () => {
    const parsed = tagFormSchema.safeParse({ name, color })
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? 'Name this tag')
      return
    }
    setCreateError('')
    try {
      const created = await createTag.mutateAsync(parsed.data)
      onChange([...value, created.id])
      setName('')
      setCreating(false)
    } catch (err) {
      const normalized = normalizePbError(err)
      // zod already enforced shape, so a server complaint about `name` is the unique index.
      setCreateError(
        normalized.fieldErrors.name
          ? `You already have a tag named “${parsed.data.name}”.`
          : normalized.message,
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(tagsQuery.data ?? []).map((tag) => {
          const swatch = patchSwatch(tag.color)
          const selected = value.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(tag.id)}
              className="h-11 rounded-full px-4 text-sm font-semibold"
              style={
                selected
                  ? { background: swatch.core, color: 'var(--color-base-content)' }
                  : { background: swatch.soft, color: swatch.deep }
              }
            >
              {tag.name}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          className="flex h-11 items-center gap-1 rounded-full border-2 border-dashed px-4 text-sm font-semibold"
          style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          new tag
        </button>
      </div>

      {creating && (
        <div className="rounded-box flex flex-col gap-3 bg-base-100 p-4" style={{ boxShadow: 'var(--shadow-soft)' }}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Tag name</span>
            <input
              type="text"
              className="input w-full"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitNewTag()
                }
              }}
            />
          </label>

          <div className="flex items-center gap-2" role="radiogroup" aria-label="Tag color">
            {TAG_COLORS.map((option) => {
              const swatch = patchSwatch(option)
              const selected = color === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option}
                  onClick={() => setColor(option)}
                  className="grid size-11 place-items-center rounded-full"
                  style={{ background: swatch.core, color: swatch.deep }}
                >
                  {selected && <Check size={20} strokeWidth={3} />}
                </button>
              )
            })}
          </div>

          {createError && <p className="text-error text-sm">{createError}</p>}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submitNewTag()}
            disabled={createTag.isPending}
          >
            {createTag.isPending ? 'Adding…' : 'Add tag'}
          </button>
        </div>
      )}
    </div>
  )
}
