// web/src/features/home/components/DoorsRow.tsx — the quick-add doors on Home (DESIGN §9):
// Paste a link · Add a file · Type it in, one row, sharing the dock ➕ sheet's palette,
// captions, and door logic (usePasteLinkDoor / useAddFileDoor). The hidden file input lives
// here so the picker opens from the door's own user gesture; door errors render inline,
// matching the sheet.
import { useNavigate } from 'react-router'
import { ClipboardPaste, FileUp, PenLine } from 'lucide-react'
import { useAddFileDoor } from '../../patterns/useAddFileDoor.ts'
import { usePasteLinkDoor } from '../../patterns/usePasteLinkDoor.ts'

function DoorTile({
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
      className="rounded-box flex min-h-28 flex-col items-start justify-between gap-2 p-4 text-left"
      style={{ background: soft, color: deep }}
    >
      {icon}
      <span className="flex flex-col">
        <span className="font-display text-lg leading-tight font-semibold">{title}</span>
        <span className="text-xs">{caption}</span>
      </span>
    </button>
  )
}

export function DoorsRow() {
  const navigate = useNavigate()
  const { busy, error, inputRef, onInputChange } = useAddFileDoor()
  const paste = usePasteLinkDoor()
  const anyBusy = busy || paste.busy

  return (
    <section className="flex flex-col gap-3 px-5">
      <h2 className="font-display text-xl font-semibold lowercase">add a pattern</h2>

      <div className="grid grid-cols-3 gap-3">
        <DoorTile
          icon={
            paste.busy ? (
              <span className="loading loading-spinner" />
            ) : (
              <ClipboardPaste size={28} strokeWidth={2} aria-hidden="true" />
            )
          }
          title="Paste a link"
          caption={paste.busy ? 'Fetching that page…' : 'A link you copied'}
          soft="var(--patch-lilac-soft)"
          deep="var(--patch-lilac-deep)"
          disabled={anyBusy}
          onPress={paste.onPress}
        />
        <DoorTile
          icon={
            busy ? (
              <span className="loading loading-spinner" />
            ) : (
              <FileUp size={28} strokeWidth={2} aria-hidden="true" />
            )
          }
          title="Add a file"
          caption={busy ? 'Reading your file…' : 'A PDF or a photo'}
          soft="var(--patch-blue-soft)"
          deep="var(--patch-blue-deep)"
          disabled={anyBusy}
          onPress={() => inputRef.current?.click()}
        />
        <DoorTile
          icon={<PenLine size={28} strokeWidth={2} aria-hidden="true" />}
          title="Type it in"
          caption="Start from a blank form"
          soft="var(--patch-mint-soft)"
          deep="var(--patch-mint-deep)"
          disabled={anyBusy}
          onPress={() => navigate('/patterns/new')}
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}
      {paste.error && <p className="text-error text-sm">{paste.error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onInputChange}
      />
    </section>
  )
}
