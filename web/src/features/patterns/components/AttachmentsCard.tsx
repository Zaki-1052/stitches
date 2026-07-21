// web/src/features/patterns/components/AttachmentsCard.tsx — the copyright vault (Session 1.3,
// DESIGN §9): owner-only, lock + "Only you can ever see these." Files are Protected, so View
// links carry a prefetched short-lived token (protectedFiles.ts) and render as plain <a href>.
// One record per file; the typed pattern lives in a single text-only record, edited in place.
// The rules enforce all of this server-side — this card is the owner's UX for it (SPEC §15).
import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { FileImage, FileText, FileUp, Lock, Pencil, PenLine, X } from 'lucide-react'
import { pb } from '../../../lib/pb.ts'
import type { AttachmentRecord, PatternRecord } from '../../../lib/schema.ts'
import { formatBytes } from '../../../lib/bytes.ts'
import { useOnlineStatus } from '../../../lib/network.ts'
import {
  keepFile,
  keptFileKey,
  unkeepAllForAttachment,
  unkeepFile,
  useKeptFileIds,
  useKeptFileSizes,
} from '../../../lib/keptFiles.ts'
import { useKeptAttachments } from '../useKeptAttachments.ts'
import { useToast } from '../../shared/toast.tsx'
import { normalizePbError } from '../../shared/errors.ts'
import { ImagePipelineError, processImage, revokePreview } from '../../shared/imagePipeline.ts'
import type { ProcessedImage } from '../../shared/imagePipeline.ts'
import { PdfThumbnailError, renderPdfPageOneThumbnail } from '../../shared/pdfThumbnail.ts'
import { protectedFileUrl, useFileToken } from '../../shared/protectedFiles.ts'
import { usePatternAttachments } from '../attachmentQueries.ts'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_MB,
  useCreateAttachment,
  useDeleteAttachment,
  useUpdateAttachment,
} from '../attachmentMutations.ts'
import { useUpdatePattern } from '../mutations.ts'
import { LazyNotesEditor as NotesEditor } from './LazyNotesEditor.tsx'

function isPdfFilename(filename: string): boolean {
  return /\.pdf$/i.test(filename)
}

// Plain-language delete confirm (DESIGN §11), same shell as DeleteConfirmDialog.
function DeleteFileDialog({
  target,
  deleting,
  onClose,
  onConfirm,
}: {
  target: AttachmentRecord | null
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = target !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
      <div className="modal-box flex flex-col gap-4 bg-base-100">
        <h3 className="font-display text-xl font-bold">Delete this file?</h3>
        <p>Delete “{target?.label || target?.files[0]}” from your vault? This can't be undone.</p>
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error btn-lg flex-1"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete file'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" disabled={deleting}>
          close
        </button>
      </form>
    </dialog>
  )
}

export function AttachmentsCard({ pattern }: { pattern: PatternRecord }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const attachmentsQuery = usePatternAttachments(pattern.id)
  const createAttachment = useCreateAttachment()
  const updateAttachment = useUpdateAttachment()
  const deleteAttachment = useDeleteAttachment()
  const updatePattern = useUpdatePattern()

  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<AttachmentRecord | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [textDraft, setTextDraft] = useState('')

  const records = attachmentsQuery.data ?? []
  const fileRecords = records.filter((r) => r.files.length > 0)
  const textRecord = records.find((r) => r.pattern_text !== '')

  const tokenQuery = useFileToken(fileRecords.length > 0)
  const token = tokenQuery.data

  // "Keep on this phone" (ADDONS §3.6): owner-scoped IDB blobs, object URLs for offline View.
  const online = useOnlineStatus()
  const keptIds = useKeptFileIds()
  const keptSizes = useKeptFileSizes()
  const keptUrls = useKeptAttachments(fileRecords)
  const [keepBusyId, setKeepBusyId] = useState<string | null>(null)

  const handleKeepToggle = async (rec: AttachmentRecord, kept: boolean) => {
    const filename = rec.files[0]
    if (kept) {
      await unkeepFile(pattern.owner, rec.id, filename)
      return
    }
    setKeepBusyId(rec.id)
    try {
      // One-shot token, NOT the shared 60 s useFileToken query — this is a single download
      // moment, not a viewing session.
      const oneShotToken = await pb.files.getToken()
      const res = await fetch(protectedFileUrl(rec, filename, oneShotToken))
      if (!res.ok) throw new Error(`keep fetch failed: ${res.status}`)
      await keepFile(pattern.owner, rec.id, filename, await res.blob())
    } catch (err) {
      console.error('[keep]', err)
      toast("Couldn't keep that file. Try again?", 'error')
    } finally {
      setKeepBusyId(null)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploadError('')
    setUploadBusy(true)
    try {
      let attachmentFile: File
      // SPEC §8: if the pattern has no thumbnail yet, the upload's page-1/processed image
      // becomes it. Generated only when needed; failure is soft (the vault still gets the file).
      let backfillThumb: ProcessedImage | null = null

      if (file.type === 'application/pdf') {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setUploadError(`That PDF is over ${MAX_ATTACHMENT_MB} MB, too big to store here.`)
          return
        }
        attachmentFile = file
        if (!pattern.thumbnail) {
          try {
            backfillThumb = await renderPdfPageOneThumbnail(file)
          } catch (err) {
            if (!(err instanceof PdfThumbnailError)) throw err
          }
        }
      } else {
        // Images (incl. iPhone HEIC) run the §8 pipeline; the attachment field's MIME list has
        // no HEIC, so the converted WebP is what gets vaulted.
        let processed: ProcessedImage
        try {
          processed = await processImage(file)
        } catch (err) {
          setUploadError(
            err instanceof ImagePipelineError ? err.message : 'Something went wrong. Try again?',
          )
          return
        }
        attachmentFile = processed.file
        if (!pattern.thumbnail) backfillThumb = processed
      }

      const fd = new FormData()
      fd.append('owner', pattern.owner)
      fd.append('pattern', pattern.id)
      fd.append('label', file.name)
      fd.append('files', attachmentFile)
      try {
        await createAttachment.mutateAsync(fd)
      } catch (err) {
        setUploadError(normalizePbError(err).message)
        return
      }
      toast('Added to your vault ♡', 'success')

      if (backfillThumb) {
        // A FormData with only `thumbnail` present — PB leaves every other field alone.
        const thumbFd = new FormData()
        thumbFd.append('thumbnail', backfillThumb.file)
        try {
          await updatePattern.mutateAsync({ id: pattern.id, body: thumbFd })
        } catch (err) {
          console.error('[attachments] thumbnail backfill failed', err)
          toast("The file's in, but the cover photo didn't stick. Add one anytime.", 'error')
        } finally {
          revokePreview(backfillThumb.previewUrl)
        }
      }
    } finally {
      setUploadBusy(false)
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!confirmTarget) return
    try {
      await deleteAttachment.mutateAsync({ id: confirmTarget.id, pattern: pattern.id })
      // The kept copy dies with its attachment (ADDONS §3.6). Call-site cleanup on purpose —
      // attachmentMutations.ts stays a pure PB-write module.
      await unkeepAllForAttachment(pattern.owner, confirmTarget.id)
      toast('File deleted.', 'success')
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    } finally {
      setConfirmTarget(null)
    }
  }

  const textSaving =
    createAttachment.isPending || updateAttachment.isPending || deleteAttachment.isPending

  const saveText = async () => {
    try {
      if (textRecord) {
        if (textDraft === '' && textRecord.files.length === 0) {
          // An emptied text-only record has nothing left to say — tidy it away.
          await deleteAttachment.mutateAsync({ id: textRecord.id, pattern: pattern.id })
        } else {
          // Resend the unchanged pattern relation — the proven-open update path under the
          // rules' :changed lock (rules-check exercises exactly this).
          await updateAttachment.mutateAsync({
            id: textRecord.id,
            body: { pattern_text: textDraft, pattern: textRecord.pattern },
          })
        }
      } else if (textDraft !== '') {
        const fd = new FormData()
        fd.append('owner', pattern.owner)
        fd.append('pattern', pattern.id)
        fd.append('pattern_text', textDraft)
        await createAttachment.mutateAsync(fd)
      }
      setEditingText(false)
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    }
  }

  const startEditingText = () => {
    setTextDraft(textRecord?.pattern_text ?? '')
    setEditingText(true)
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Lock size={20} strokeWidth={2.5} aria-hidden="true" />
        attachments
      </h2>

      <div
        className="rounded-box flex flex-col gap-4 bg-base-100 p-4"
        style={{ boxShadow: 'var(--shadow-soft)' }}
      >
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Only you can ever see these.
        </p>

        {attachmentsQuery.isPending ? (
          <div className="grid place-items-center py-4">
            <span className="loading loading-spinner" />
          </div>
        ) : attachmentsQuery.isError ? (
          <p className="text-error text-sm">
            Couldn't load your attachments. Try again in a moment?
          </p>
        ) : (
          <>
            {fileRecords.length > 0 && (
              <ul className="flex flex-col gap-3">
                {fileRecords.map((rec) => {
                  const filename = rec.files[0]
                  const Icon = isPdfFilename(filename) ? FileText : FileImage
                  const key = keptFileKey(pattern.owner, rec.id, filename)
                  const kept = keptIds.has(key)
                  const keptUrl = keptUrls[key]
                  const sizeBytes = keptSizes.get(key)
                  // Kept object URL first (works offline); token URL otherwise. Both render as
                  // a synchronous <a href> — the iOS popup-blocker rule.
                  const viewHref = keptUrl ?? (token ? protectedFileUrl(rec, filename, token) : null)
                  return (
                    <li key={rec.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <Icon size={24} strokeWidth={2} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {rec.label || filename}
                        </span>
                        {viewHref ? (
                          <a className="btn btn-ghost" href={viewHref} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          <span className="btn btn-ghost btn-disabled">View</span>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${rec.label || filename}`}
                          className="btn btn-ghost btn-circle"
                          onClick={() => setConfirmTarget(rec)}
                        >
                          <X size={20} strokeWidth={2.5} />
                        </button>
                      </div>
                      <label className="flex min-h-11 items-center gap-2 pl-9">
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={kept}
                          disabled={keepBusyId === rec.id}
                          onChange={() => void handleKeepToggle(rec, kept)}
                          aria-label={`Keep ${rec.label || filename} on this phone`}
                        />
                        <span className="text-sm">Keep on this phone</span>
                        {keepBusyId === rec.id && <span className="loading loading-spinner loading-xs" />}
                        {kept && sizeBytes !== undefined && (
                          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                            {formatBytes(sizeBytes)}
                          </span>
                        )}
                        {kept && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              background: 'var(--patch-mint-soft)',
                              color: 'var(--patch-mint-deep)',
                            }}
                          >
                            On this phone
                          </span>
                        )}
                      </label>
                      {!kept && !online && (
                        <p className="pl-9 text-xs" style={{ color: 'var(--ink-muted)' }}>
                          This file needs the internet. Keep it on this phone to read it offline.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {fileRecords.some((rec) =>
              keptIds.has(keptFileKey(pattern.owner, rec.id, rec.files[0])),
            ) && (
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Saved for offline reading. iOS may clear it if space runs very low.
              </p>
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploadBusy}
              className="rounded-box flex min-h-14 items-center justify-center gap-2 border-2 border-dashed text-sm font-semibold"
              style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
            >
              {uploadBusy ? (
                <span className="loading loading-spinner" />
              ) : (
                <>
                  <FileUp size={20} strokeWidth={2} aria-hidden="true" />
                  Add a file
                </>
              )}
            </button>

            {uploadError && <p className="text-error text-sm">{uploadError}</p>}

            <div className="flex flex-col gap-2">
              <div className="flex min-h-11 items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
                  typed pattern
                </h3>
                {textRecord && !editingText && (
                  <button
                    type="button"
                    aria-label="Edit typed pattern"
                    className="btn btn-ghost btn-circle"
                    onClick={startEditingText}
                  >
                    <Pencil size={20} strokeWidth={2} />
                  </button>
                )}
              </div>

              {editingText ? (
                <>
                  <NotesEditor value={textDraft} onChange={setTextDraft} ariaLabel="Typed pattern" />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setEditingText(false)}
                      disabled={textSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary flex-1"
                      onClick={() => void saveText()}
                      disabled={textSaving}
                    >
                      {textSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : textRecord ? (
                <div
                  className="rich-text rounded-box border px-4 py-3"
                  style={{ borderColor: 'var(--color-base-300)' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(textRecord.pattern_text) }}
                />
              ) : (
                <button
                  type="button"
                  onClick={startEditingText}
                  className="rounded-box flex min-h-14 items-center justify-center gap-2 border-2 border-dashed text-sm font-semibold"
                  style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
                >
                  <PenLine size={20} strokeWidth={2} aria-hidden="true" />
                  Type the pattern in
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <DeleteFileDialog
        target={confirmTarget}
        deleting={deleteAttachment.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  )
}
