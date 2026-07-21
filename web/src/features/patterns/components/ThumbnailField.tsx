// web/src/features/patterns/components/ThumbnailField.tsx — the single cover image. Every pick
// runs the §8 pipeline before it ever touches form state; removing has its own explicit "×"
// (distinct from "never touched it", which must leave the stored file alone on edit). State
// lives in the parent form (read at submit); this component owns only busy/error UI.
import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ImagePipelineError, processImage, revokePreview } from '../../shared/imagePipeline.ts'
import type { ThumbnailState } from '../formData.ts'

export function ThumbnailField({
  state,
  existingUrl,
  onChange,
  onBusyChange,
}: {
  state: ThumbnailState
  existingUrl: string | null
  onChange: (next: ThumbnailState) => void
  onBusyChange: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const previewUrl =
    state.kind === 'new' ? state.image.previewUrl : state.kind === 'unchanged' ? existingUrl : null

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    onBusyChange(true)
    try {
      const image = await processImage(file)
      if (state.kind === 'new') revokePreview(state.image.previewUrl)
      onChange({ kind: 'new', image })
    } catch (err) {
      setError(
        err instanceof ImagePipelineError ? err.message : 'Something went wrong. Try again?',
      )
    } finally {
      setBusy(false)
      onBusyChange(false)
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = () => {
    if (state.kind === 'new') revokePreview(state.image.previewUrl)
    onChange({ kind: 'removed' })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">Photo</span>

      {previewUrl ? (
        <div className="relative w-40">
          <button
            type="button"
            aria-label="Replace photo"
            className="block w-full overflow-hidden rounded-box"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <img src={previewUrl} alt="" className="aspect-[4/5] w-full object-cover" />
          </button>
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-box bg-base-100/70">
              <span className="loading loading-spinner" />
            </span>
          )}
          <button
            type="button"
            aria-label="Remove photo"
            onClick={remove}
            disabled={busy}
            className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-base-100"
            style={{ boxShadow: 'var(--shadow-soft)' }}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="grid aspect-[4/5] w-40 place-items-center rounded-box border-2 border-dashed"
          style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
        >
          {busy ? (
            <span className="loading loading-spinner" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-sm font-semibold">
              <ImagePlus size={24} strokeWidth={2} />
              Add a photo
            </span>
          )}
        </button>
      )}

      {error && <p className="text-error text-sm">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
