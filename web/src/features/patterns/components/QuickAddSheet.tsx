// web/src/features/patterns/components/QuickAddSheet.tsx — the dock ➕ quick-add sheet (DESIGN
// §9's import doors: Paste a link · Add a file · Type it in). "Paste a link" runs the shared
// usePasteLinkDoor hook — clipboard → importer extract → pre-filled form (soft-fail: URL-only
// form + gentle toast). "Add a file" runs useAddFileDoor (also behind Home's doors row) — pdfjs
// page-1 → WebP for PDFs (soft-fail), the §8 pipeline for images (hard-fail) — and lands on
// /patterns/new pre-filled. "Type it in" is the blank form. The hidden file input lives inside
// the <dialog> so the picker opens from the button's own user gesture; door errors render
// inline because the dialog's top layer would paint over any toast.
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardPaste, FileUp, PenLine } from 'lucide-react'
import { useAddFileDoor } from '../useAddFileDoor.ts'
import { usePasteLinkDoor } from '../usePasteLinkDoor.ts'

function Door({
  icon,
  title,
  caption,
  soft,
  deep,
  disabled,
  onPress,
}: {
  icon: React.ReactNode
  title: string
  caption: string
  soft: string
  deep: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className="rounded-box flex min-h-20 items-center gap-4 px-5 py-4 text-left"
      style={{ background: soft, color: deep }}
    >
      {icon}
      <span className="flex flex-col">
        <span className="font-display text-lg font-semibold">{title}</span>
        <span className="text-sm">{caption}</span>
      </span>
    </button>
  )
}

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const { busy, error, clearError, inputRef, onInputChange } = useAddFileDoor(onClose)
  const paste = usePasteLinkDoor(onClose)
  const clearPasteError = paste.clearError
  const anyBusy = busy || paste.busy

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      clearError()
      clearPasteError()
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, clearError, clearPasteError])

  return (
    <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
      <div className="modal-box flex flex-col gap-4 bg-base-100">
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'var(--color-base-300)' }}
          aria-hidden="true"
        />
        <h2 className="font-display text-xl font-semibold">add a pattern</h2>

        <Door
          icon={
            paste.busy ? (
              <span className="loading loading-spinner" />
            ) : (
              <ClipboardPaste size={28} strokeWidth={2} aria-hidden="true" />
            )
          }
          title="Paste a link"
          caption={paste.busy ? 'Fetching that page…' : 'A pattern page from the web'}
          soft="var(--patch-lilac-soft)"
          deep="var(--patch-lilac-deep)"
          disabled={anyBusy}
          onPress={paste.onPress}
        />

        <Door
          icon={
            busy ? (
              <span className="loading loading-spinner" />
            ) : (
              <FileUp size={28} strokeWidth={2} aria-hidden="true" />
            )
          }
          title="Add a file"
          caption={busy ? 'Reading your file…' : 'A PDF or a photo of a pattern'}
          soft="var(--patch-blue-soft)"
          deep="var(--patch-blue-deep)"
          disabled={anyBusy}
          onPress={() => inputRef.current?.click()}
        />

        <Door
          icon={<PenLine size={28} strokeWidth={2} aria-hidden="true" />}
          title="Type it in"
          caption="Start from a blank form"
          soft="var(--patch-mint-soft)"
          deep="var(--patch-mint-deep)"
          disabled={anyBusy}
          onPress={() => {
            onClose()
            navigate('/patterns/new')
          }}
        />

        {error && <p className="text-error text-sm">{error}</p>}
        {paste.error && <p className="text-error text-sm">{paste.error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" disabled={anyBusy}>
          close
        </button>
      </form>
    </dialog>
  )
}
