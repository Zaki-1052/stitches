// web/src/features/shared/errors.ts — the one PB error normalizer (SPEC §12): field errors go
// inline via RHF setError, everything else becomes a toast message. PB's 400 body nests
// per-field details under response.data: { field: { code, message } }.
import { ClientResponseError } from 'pocketbase'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

export interface NormalizedPbError {
  status: number
  message: string
  fieldErrors: Record<string, string>
}

const FALLBACK_MESSAGE = 'Something went wrong — try again?'

export function normalizePbError(err: unknown): NormalizedPbError {
  console.error('[pb]', err)
  if (!(err instanceof ClientResponseError)) {
    return { status: 0, message: FALLBACK_MESSAGE, fieldErrors: {} }
  }
  const body = err.response as { message?: unknown; data?: unknown }
  const fieldErrors: Record<string, string> = {}
  if (body.data && typeof body.data === 'object') {
    for (const [field, detail] of Object.entries(body.data as Record<string, unknown>)) {
      const message = (detail as { message?: unknown } | null)?.message
      if (typeof message === 'string' && message) fieldErrors[field] = message
    }
  }
  const message = typeof body.message === 'string' && body.message ? body.message : FALLBACK_MESSAGE
  return { status: err.status, message, fieldErrors }
}

// Maps PB field errors onto matching RHF fields; returns true if at least one landed inline
// (callers toast the top-level message only when nothing did).
export function applyFieldErrors<T extends FieldValues>(
  normalized: NormalizedPbError,
  setError: UseFormSetError<T>,
  knownFields: ReadonlyArray<string>,
): boolean {
  let applied = false
  for (const [field, message] of Object.entries(normalized.fieldErrors)) {
    if (knownFields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
      applied = true
    }
  }
  return applied
}
