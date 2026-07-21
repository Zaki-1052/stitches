// web/src/features/patterns/useAddFileDoor.ts — the "Add a file" door's pick-and-process logic,
// shared by the dock ➕ QuickAddSheet and Home's doors row (Session 2.3). PDFs upload as-is with
// a pdfjs page-1 → WebP thumbnail (soft-fail: the pattern just has no thumbnail); images (incl.
// iPhone HEIC) run the §8 pipeline (hard-fail: undecodable files get a clear inline error).
// The processed pick lands in pendingAttachmentImport and navigation goes to the pre-filled
// save form. Callers render their own door buttons and their own hidden file input (the picker
// must open from the button's own user gesture) wired to `inputRef` + `onInputChange`.
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../shared/toast.tsx'
import { ImagePipelineError, processImage } from '../shared/imagePipeline.ts'
import type { ProcessedImage } from '../shared/imagePipeline.ts'
import { PdfThumbnailError, renderPdfPageOneThumbnail } from '../shared/pdfThumbnail.ts'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_MB } from './attachmentMutations.ts'
import { setPendingAttachmentImport } from './pendingAttachmentImport.ts'

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

export function useAddFileDoor(onPicked?: () => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
          setError(`That PDF is over ${MAX_ATTACHMENT_MB} MB, too big to store here.`)
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
            err instanceof ImagePipelineError ? err.message : 'Something went wrong. Try again?',
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
      onPicked?.()
      navigate('/patterns/new')
      if (softNote) toast(softNote, 'info')
    } finally {
      setBusy(false)
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0])
  }

  // Stable so the sheet's open/close effect can list it as a dependency.
  const clearError = useCallback(() => setError(''), [])

  return { busy, error, clearError, inputRef, onInputChange }
}
