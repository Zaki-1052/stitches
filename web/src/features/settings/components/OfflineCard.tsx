// web/src/features/settings/components/OfflineCard.tsx — offline & sync (ADDONS §3.3/§3.6):
// the "Last synced" line + Sync now button, the sync failure message, and the kept-files
// summary + Clear all kept files. Card shell matches the other settings cards.
import { useState } from 'react'
import { formatRelativeTime } from '../../../lib/dates.ts'
import { formatBytes } from '../../../lib/bytes.ts'
import { triggerSync, useSyncStatus } from '../../../lib/sync.ts'
import { clearAllKept, useKeptFilesSummary } from '../../../lib/keptFiles.ts'
import { ConfirmDeleteDialog } from '../../projects/components/ConfirmDeleteDialog.tsx'

export function OfflineCard() {
  const { lastSyncedAt, inProgress, error } = useSyncStatus()
  const { count, totalBytes } = useKeptFilesSummary()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await clearAllKept()
    } finally {
      setClearing(false)
      setConfirmOpen(false)
    }
  }

  return (
    <section
      className="rounded-box flex flex-col gap-4 bg-base-100 p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <h2 className="font-display text-xl font-semibold lowercase">Offline</h2>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Last synced {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : 'never'}
      </p>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={() => void triggerSync({ force: true })}
        disabled={inProgress}
      >
        {inProgress ? 'Syncing…' : 'Sync now'}
      </button>
      {error && <p className="text-error text-sm">{error}</p>}

      {count > 0 && (
        <>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {count} {count === 1 ? 'file' : 'files'} kept · {formatBytes(totalBytes)}
          </p>
          <button
            type="button"
            className="btn btn-outline btn-error"
            onClick={() => setConfirmOpen(true)}
          >
            Clear all kept files
          </button>
        </>
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Remove kept files from this phone?"
        body="They stay safe in your vault."
        confirmLabel="Remove"
        deleting={clearing}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleClearAll()}
      />
    </section>
  )
}
