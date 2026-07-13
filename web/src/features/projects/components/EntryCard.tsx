// web/src/features/projects/components/EntryCard.tsx — one diary entry: sanitized body, photos
// in a rounded grid (?thumb= variants, tap → original), owner-only pencil/trash. The feed's date
// group headers carry the date, so the card doesn't repeat it.
import DOMPurify from 'dompurify'
import { Pencil, Trash2 } from 'lucide-react'
import { pb } from '../../../lib/pb.ts'
import type { JournalEntryRecord } from '../../../lib/schema.ts'

export function EntryCard({
  entry,
  isOwner,
  onEdit,
  onDelete,
}: {
  entry: JournalEntryRecord
  isOwner: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article
      className="rounded-box flex flex-col gap-3 bg-base-100 p-4"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {entry.body && (
        <div
          className="rich-text"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.body) }}
        />
      )}

      {entry.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {entry.photos.map((filename) => (
            <a
              key={filename}
              href={pb.files.getURL(entry, filename)}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={pb.files.getURL(entry, filename, { thumb: '400x0' })}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="-mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Edit entry"
            className="btn btn-ghost btn-circle"
            onClick={onEdit}
          >
            <Pencil size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Delete entry"
            className="btn btn-ghost btn-circle"
            onClick={onDelete}
          >
            <Trash2 size={20} strokeWidth={2} />
          </button>
        </div>
      )}
    </article>
  )
}
