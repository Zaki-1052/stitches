// web/src/features/patterns/components/PhotosField.tsx — the ≤10 inspiration shots. Client
// enforces the total cap (existing − removed + added) ahead of the server's field cap, shows a
// live "N of 10", and per-file pipeline failures ("please convert this one") never block the
// files that did decode. Removal of stored photos is by filename (PB's `photos-` modifier).
import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { processImages, revokePreview } from '../../shared/imagePipeline.ts'
import type { PhotosState } from '../formData.ts'

const MAX_PHOTOS = 10

export function PhotosField({
  photos,
  onChange,
  onBusyChange,
  urlFor,
}: {
  photos: PhotosState
  onChange: (next: PhotosState) => void
  onBusyChange: (busy: boolean) => void
  urlFor: (filename: string) => string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const keptExisting = photos.existing.filter((name) => !photos.removed.includes(name))
  const total = keptExisting.length + photos.added.length
  const remaining = MAX_PHOTOS - total

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const picked = Array.from(fileList)
    const usable = picked.slice(0, Math.max(0, remaining))
    const overflow = picked.length - usable.length
    setErrors(overflow > 0 ? [`Only ${MAX_PHOTOS} photos fit — ${overflow} didn't make it in.`] : [])
    if (usable.length === 0) return

    setBusy(true)
    onBusyChange(true)
    try {
      const { succeeded, failed } = await processImages(usable)
      if (succeeded.length) onChange({ ...photos, added: [...photos.added, ...succeeded] })
      if (failed.length) {
        setErrors((prev) => [...prev, ...failed.map((f) => `${f.name} — ${f.message}`)])
      }
    } finally {
      setBusy(false)
      onBusyChange(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeExisting = (filename: string) => {
    onChange({ ...photos, removed: [...photos.removed, filename] })
  }

  const removeAdded = (index: number) => {
    revokePreview(photos.added[index].previewUrl)
    onChange({ ...photos, added: photos.added.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">More photos</span>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {total} of {MAX_PHOTOS}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {keptExisting.map((filename) => (
          <PhotoTile
            key={filename}
            src={urlFor(filename)}
            onRemove={() => removeExisting(filename)}
          />
        ))}
        {photos.added.map((image, index) => (
          <PhotoTile
            key={image.previewUrl}
            src={image.previewUrl}
            onRemove={() => removeAdded(index)}
          />
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="grid aspect-square place-items-center rounded-box border-2 border-dashed"
            style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
            aria-label="Add photos"
          >
            {busy ? <span className="loading loading-spinner" /> : <ImagePlus size={24} strokeWidth={2} />}
          </button>
        )}
      </div>

      {errors.map((message) => (
        <p key={message} className="text-error text-sm">
          {message}
        </p>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  )
}

function PhotoTile({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative">
      <img src={src} alt="" className="aspect-square w-full rounded-box object-cover" />
      <button
        type="button"
        aria-label="Remove photo"
        onClick={onRemove}
        className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-base-100"
        style={{ boxShadow: 'var(--shadow-soft)' }}
      >
        <X size={20} strokeWidth={2.5} />
      </button>
    </div>
  )
}
