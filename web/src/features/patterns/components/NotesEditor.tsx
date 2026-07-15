// web/src/features/patterns/components/NotesEditor.tsx — TipTap editor for the PB `editor` notes
// field (Zara's 1.2 decision: real rich text, no textarea). Deliberately small surface: bold,
// italic, lists. StarterKit's block extras (headings, code blocks, quotes, rules) are disabled so
// a stray "# " markdown shortcut can't turn craft notes into a poster headline — notes stay plain
// (DESIGN §11). Emits '' when visually empty so an untouched field clears cleanly server-side.
import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Editor } from '@tiptap/react'

function ToolbarButton({
  editor,
  label,
  icon: Icon,
  active,
  onPress,
}: {
  editor: Editor
  label: string
  icon: LucideIcon
  active: boolean
  onPress: (editor: Editor) => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={`btn btn-ghost btn-square size-11 ${active ? 'btn-active' : ''}`}
      onClick={() => onPress(editor)}
    >
      <Icon size={24} strokeWidth={2} />
    </button>
  )
}

export interface NotesEditorProps {
  value: string
  onChange: (html: string) => void
  ariaLabel?: string
}

export function NotesEditor({ value, onChange, ariaLabel = 'Notes' }: NotesEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'rich-text px-4 py-3', 'aria-label': ariaLabel },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? '' : current.getHTML())
    },
  })

  // Safety net for externally-reset form values: sync into the editor without re-emitting
  // onUpdate (which would loop) and without clobbering identical in-progress content.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) editor.commands.setContent(value || '', false)
  }, [editor, value])

  if (!editor) return null

  return (
    <div
      className="rounded-box border bg-base-100 focus-within:outline-2"
      style={{
        borderColor: 'var(--color-base-300)',
        outlineColor: 'var(--patch-blue-deep)',
      }}
    >
      <div
        className="flex gap-1 border-b px-2 py-1"
        role="toolbar"
        aria-label="Formatting"
        style={{ borderColor: 'var(--color-base-300)' }}
      >
        <ToolbarButton
          editor={editor}
          label="Bold"
          icon={Bold}
          active={editor.isActive('bold')}
          onPress={(e) => e.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Italic"
          icon={Italic}
          active={editor.isActive('italic')}
          onPress={(e) => e.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Bullet list"
          icon={List}
          active={editor.isActive('bulletList')}
          onPress={(e) => e.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Numbered list"
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onPress={(e) => e.chain().focus().toggleOrderedList().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
