// web/src/features/settings/components/ProfileCard.tsx — name + avatar (DESIGN §9 Settings).
// The avatar follows ThumbnailField's three-state convention: `unchanged` never sends the field
// (never clobbers the stored file), `new` uploads through the §8 pipeline, `removed` sends null.
// The SDK merges the update response into pb.authStore when it's the current auth record, so
// AppHeader's greeting and avatar refresh themselves — no cache plumbing here.
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, X } from 'lucide-react'
import { pb } from '../../../lib/pb.ts'
import { useAuth } from '../../../lib/auth.tsx'
import { useToast } from '../../shared/toast.tsx'
import { applyFieldErrors, normalizePbError } from '../../shared/errors.ts'
import { ImagePipelineError, processImage, revokePreview } from '../../shared/imagePipeline.ts'
import { useRevokeOnUnmount } from '../../shared/useRevokeOnUnmount.ts'
import type { ProcessedImage } from '../../shared/imagePipeline.ts'

const schema = z.object({
  name: z.string().trim().min(1, 'Please enter a name.'),
})
type ProfileValues = z.infer<typeof schema>

type AvatarState =
  | { kind: 'unchanged' }
  | { kind: 'new'; image: ProcessedImage }
  | { kind: 'removed' }

export function ProfileCard() {
  const { user } = useAuth()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState<AvatarState>({ kind: 'unchanged' })
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name || '' },
  })

  // 4.2: a picked-but-unsaved avatar preview releases on any exit (see useRevokeOnUnmount).
  useRevokeOnUnmount(() => (avatar.kind === 'new' ? [avatar.image.previewUrl] : []))

  const name = user?.name || 'friend'
  const initial = name.trim().charAt(0).toUpperCase() || '♡'
  const existingUrl = user && user.avatar ? pb.files.getURL(user, user.avatar) : null
  const previewUrl =
    avatar.kind === 'new'
      ? avatar.image.previewUrl
      : avatar.kind === 'unchanged'
        ? existingUrl
        : null

  const dirty = isDirty || avatar.kind !== 'unchanged'

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setAvatarError('')
    setAvatarBusy(true)
    try {
      const image = await processImage(file)
      if (avatar.kind === 'new') revokePreview(avatar.image.previewUrl)
      setAvatar({ kind: 'new', image })
    } catch (err) {
      setAvatarError(
        err instanceof ImagePipelineError ? err.message : 'Something went wrong. Try again?',
      )
    } finally {
      setAvatarBusy(false)
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeAvatar = () => {
    if (avatar.kind === 'new') revokePreview(avatar.image.previewUrl)
    setAvatar(existingUrl ? { kind: 'removed' } : { kind: 'unchanged' })
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    try {
      let body: FormData | { name: string; avatar?: null }
      if (avatar.kind === 'new') {
        const fd = new FormData()
        fd.append('name', values.name)
        fd.append('avatar', avatar.image.file)
        body = fd
      } else if (avatar.kind === 'removed') {
        body = { name: values.name, avatar: null }
      } else {
        body = { name: values.name }
      }
      await pb.collection('users').update(user.id, body)
      if (avatar.kind === 'new') revokePreview(avatar.image.previewUrl)
      setAvatar({ kind: 'unchanged' })
      reset({ name: values.name })
      toast('Saved ♡', 'success')
    } catch (err) {
      const normalized = normalizePbError(err)
      if (normalized.fieldErrors.avatar) {
        setAvatarError(normalized.fieldErrors.avatar)
      } else if (!applyFieldErrors(normalized, setError, ['name'])) {
        toast(normalized.message, 'error')
      }
    }
  })

  return (
    <section
      className="rounded-box flex flex-col gap-4 bg-base-100 p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <h2 className="font-display text-xl font-semibold lowercase">profile</h2>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={previewUrl ? 'Change photo' : 'Add a photo'}
            onClick={() => inputRef.current?.click()}
            disabled={avatarBusy}
            className="grid size-24 place-items-center overflow-hidden rounded-full"
            style={{ background: 'var(--patch-lilac-soft)' }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="size-full object-cover" />
            ) : (
              <span
                className="font-display text-3xl font-bold"
                style={{ color: 'var(--patch-lilac-deep)' }}
              >
                {initial}
              </span>
            )}
          </button>
          {avatarBusy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-base-100/70">
              <span className="loading loading-spinner" />
            </span>
          )}
          {previewUrl && (
            <button
              type="button"
              aria-label="Remove photo"
              onClick={removeAvatar}
              disabled={avatarBusy}
              className="absolute -top-1 -right-1 grid size-11 place-items-center rounded-full bg-base-100"
              style={{ boxShadow: 'var(--shadow-soft)' }}
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={avatarBusy}
          className="btn btn-ghost"
        >
          <Pencil size={20} strokeWidth={2} aria-hidden="true" />
          {previewUrl ? 'Change photo' : 'Add a photo'}
        </button>
      </div>

      {avatarError && <p className="text-error text-sm">{avatarError}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Name</span>
          <input type="text" autoComplete="name" className="input input-lg w-full" {...register('name')} />
          {errors.name && <span className="text-error text-sm">{errors.name.message}</span>}
        </label>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={!dirty || avatarBusy || isSubmitting}
        >
          {isSubmitting ? 'One sec…' : 'Save'}
        </button>
      </form>
    </section>
  )
}
