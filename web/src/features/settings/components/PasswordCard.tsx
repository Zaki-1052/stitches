// web/src/features/settings/components/PasswordCard.tsx — change password, old + new (DESIGN
// §9). This matters: there is no SMTP (SPEC §9), so this flow is the only self-service reset.
// PocketBase rotates the token key on a password change, killing the stored token — so after a
// successful update the card immediately re-authenticates with the new password. If that second
// step fails (network gap), the password IS changed but our token is dead; the only honest
// recovery is clearing the store so ProtectedRoute routes to /login — never keep a dead token
// (every later request would 401 confusingly).
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { pb } from '../../../lib/pb.ts'
import { useAuth } from '../../../lib/auth.tsx'
import { useToast } from '../../shared/toast.tsx'
import { applyFieldErrors, normalizePbError } from '../../shared/errors.ts'
import { PasswordInput } from '../../../components/PasswordInput.tsx'

const schema = z
  .object({
    oldPassword: z.string().min(1, 'Enter your current password.'),
    password: z.string().min(8, 'At least 8 characters.'),
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: "These don't match yet.",
  })
type PasswordValues = z.infer<typeof schema>

export function PasswordCard() {
  const { user } = useAuth()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', password: '', passwordConfirm: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    // Grab the email before anything changes — it's what the re-auth step logs in with.
    const email = typeof user.email === 'string' ? user.email : ''
    if (!email) {
      toast('Please log in again to change your password.', 'error')
      pb.authStore.clear()
      return
    }

    try {
      await pb.collection('users').update(user.id, values)
    } catch (err) {
      const normalized = normalizePbError(err)
      if (normalized.fieldErrors.oldPassword) {
        // PB's raw message is robotic; the meaning is always the same.
        setError('oldPassword', {
          type: 'server',
          message: "That doesn't match your current password.",
        })
      } else if (!applyFieldErrors(normalized, setError, ['password', 'passwordConfirm'])) {
        toast(normalized.message, 'error')
      }
      return
    }

    try {
      await pb.collection('users').authWithPassword(email, values.password)
    } catch (err) {
      console.error('[settings] re-auth after password change failed', err)
      pb.authStore.clear()
      toast('Password changed. Log in with your new one.', 'info')
      return
    }

    reset()
    toast('Password changed ♡', 'success')
  })

  return (
    <section
      className="rounded-box flex flex-col gap-4 bg-base-100 p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <h2 className="font-display text-xl font-semibold lowercase">password</h2>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Current password</span>
          <PasswordInput autoComplete="current-password" {...register('oldPassword')} />
          {errors.oldPassword && (
            <span className="text-error text-sm">{errors.oldPassword.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">New password</span>
          <PasswordInput autoComplete="new-password" {...register('password')} />
          {errors.password && <span className="text-error text-sm">{errors.password.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">New password, again</span>
          <PasswordInput autoComplete="new-password" {...register('passwordConfirm')} />
          {errors.passwordConfirm && (
            <span className="text-error text-sm">{errors.passwordConfirm.message}</span>
          )}
        </label>

        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'One sec…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
