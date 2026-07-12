// web/src/features/patterns/components/SaveBar.tsx — the sticky safe-area Save bar (DESIGN §9).
// Sticky-in-flow (not fixed), matching the shell's approach, which is the mitigation for iOS
// Safari's keyboard-vs-fixed-bar pain (DESIGN §12 #12). Opaque so content scrolls under cleanly.
// Sits inside the page's px-5 gutter, hence the negative margin full-bleed.
export function SaveBar({
  saving,
  disabled,
  onCancel,
}: {
  saving: boolean
  disabled?: boolean
  onCancel: () => void
}) {
  return (
    <div
      className="sticky bottom-0 z-10 -mx-5 mt-6 flex gap-3 border-t px-5 pt-3"
      style={{
        background: 'var(--color-base-200)',
        borderColor: 'var(--color-base-300)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
      }}
    >
      <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary btn-lg flex-1" disabled={saving || disabled}>
        {saving ? 'Saving…' : 'Save pattern'}
      </button>
    </div>
  )
}
