// web/src/features/patterns/components/QuickAddSheet.tsx — the dock ➕ quick-add sheet (DESIGN
// §9's import doors; the paste-a-link door joins in Session 3.2). "Add a file" processes the
// pick right here — pdfjs page-1 → WebP for PDFs (soft-fail), the §8 pipeline for images
// (hard-fail) — stashes it in pendingAttachmentImport, and lands on /patterns/new pre-filled.
// "Type it in" is the blank form. The hidden file input lives inside the <dialog> so the picker
// opens from the button's own user gesture; pick errors render inline because the dialog's
// top layer would paint over any toast.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FileUp, PenLine } from 'lucide-react'
import { useToast } from '../../shared/toast.tsx'
import { ImagePipelineError, processImage } from '../../shared/imagePipeline.ts'
import type { ProcessedImage } from '../../shared/imagePipeline.ts'
import { PdfThumbnailError, renderPdfPageOneThumbnail } from '../../shared/pdfThumbnail.ts'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_MB } from '../attachmentMutations.ts'
import { setPendingAttachmentImport } from '../pendingAttachmentImport.ts'

// "vintage-doily_scan.pdf" → "vintage doily scan"
function titleFromFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'New pattern'
  )
}

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
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setError('')
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      let attachmentFile: File
      let thumbnail: ProcessedImage | null
      let softNote = ''

      if (file.type === 'application/pdf') {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(`That PDF is over ${MAX_ATTACHMENT_MB} MB — too big to store here.`)
          return
        }
        attachmentFile = file // PDFs upload as-is; only their thumbnail is an image
        thumbnail = null
        try {
          thumbnail = await renderPdfPageOneThumbnail(file)
        } catch (err) {
          if (!(err instanceof PdfThumbnailError)) throw err
          softNote = err.message
        }
      } else {
        // Images (incl. iPhone HEIC) run the §8 pipeline; the attachment field's MIME list has
        // no HEIC, so the converted WebP is what gets vaulted — and it doubles as the thumbnail.
        let processed: ProcessedImage
        try {
          processed = await processImage(file)
        } catch (err) {
          setError(
            err instanceof ImagePipelineError ? err.message : 'Something went wrong — try again?',
          )
          return
        }
        attachmentFile = processed.file
        thumbnail = processed
      }

      setPendingAttachmentImport({
        suggestedTitle: titleFromFilename(file.name),
        attachmentFile,
        attachmentLabel: file.name,
        thumbnail,
      })
      onClose()
      navigate('/patterns/new')
      if (softNote) toast(softNote, 'info')
    } finally {
      setBusy(false)
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

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
          disabled={busy}
          onPress={() => inputRef.current?.click()}
        />

        <Door
          icon={<PenLine size={28} strokeWidth={2} aria-hidden="true" />}
          title="Type it in"
          caption="Start from a blank form"
          soft="var(--patch-mint-soft)"
          deep="var(--patch-mint-deep)"
          disabled={busy}
          onPress={() => {
            onClose()
            navigate('/patterns/new')
          }}
        />

        {error && <p className="text-error text-sm">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" disabled={busy}>
          close
        </button>
      </form>
    </dialog>
  )
}
