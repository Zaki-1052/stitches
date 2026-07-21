// web/src/routes/LoginPage.tsx — invite-only login (DESIGN §9). A centered card on cream:
// yarn-ball mark, lowercase "stitches" wordmark, email + password, one big pill button, and an
// invite-only footer. There is no signup path. Errors are gentle and plain (DESIGN §11).
import { useState } from 'react'
import { Navigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { pb } from '../lib/pb.ts'
import { useAuth } from '../lib/auth.tsx'
import { YarnBall } from '../components/YarnBall.tsx'
import { PasswordInput } from '../components/PasswordInput.tsx'

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})
type LoginValues = z.infer<typeof schema>

export default function LoginPage() {
  const { user } = useAuth()
  const [authError, setAuthError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) })

  // Already signed in (or a login just succeeded → authStore changed → re-render): go home.
  if (user) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setAuthError('')
    try {
      await pb.collection('users').authWithPassword(email, password)
      // The authStore change re-renders this component; the <Navigate> above takes over.
    } catch (err) {
      console.error('[login] authWithPassword failed', err)
      setAuthError("That didn't match. Check your email and password.")
    }
  })

  return (
    <main className="grid min-h-dvh place-items-center bg-base-200 p-6">
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-box bg-base-100 p-7"
        style={{ boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="flex flex-col items-center gap-2">
          <YarnBall size={112} />
          <h1 className="font-display text-4xl font-bold lowercase">stitches</h1>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Email</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              className="input input-lg w-full"
              {...register('email')}
            />
            {errors.email && (
              <span className="text-error text-sm">{errors.email.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Password</span>
            <PasswordInput autoComplete="current-password" {...register('password')} />
            {errors.password && (
              <span className="text-error text-sm">{errors.password.message}</span>
            )}
          </label>

          {authError && (
            <p role="alert" className="text-error text-sm">
              {authError}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isSubmitting}>
            {isSubmitting ? 'One sec…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Stitches is invite-only ♡
        </p>
      </div>
    </main>
  )
}
