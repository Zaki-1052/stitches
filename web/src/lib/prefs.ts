// web/src/lib/prefs.ts — device-local preferences, localStorage-backed (SPEC §11: wake-lock
// and dim-mode preferences "remembered locally"). One JSON blob so Session 2.3's settings
// screen reads and writes the same store; hapticTick is that screen's experimental toggle,
// reserved here (default off) so the counter-prefs groundwork is complete.
import { useSyncExternalStore } from 'react'

export interface Prefs {
  counterDim: boolean
  counterWakeLock: boolean
  hapticTick: boolean
}

const STORAGE_KEY = 'stitches:prefs:v1'
const DEFAULTS: Prefs = { counterDim: false, counterWakeLock: false, hapticTick: false }

const listeners = new Set<() => void>()
let cached: Prefs = load()

function load(): Prefs {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULTS
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch (err) {
    // A hand-mangled blob shouldn't brick the counter screen; fall back to defaults loudly.
    console.warn('[prefs] discarding unreadable prefs', err)
    return DEFAULTS
  }
}

function notify(): void {
  for (const cb of listeners) cb()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getPref<K extends keyof Prefs>(name: K): Prefs[K] {
  return cached[name]
}

export function setPref<K extends keyof Prefs>(name: K, value: Prefs[K]): void {
  cached = { ...cached, [name]: value }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  notify()
}

// `storage` only fires in *other* tabs — this keeps two open tabs' toggles in step.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return
  cached = load()
  notify()
})

// Snapshot returns a primitive per key, so this dodges the fresh-object snapshot loop that
// keeps pb.authStore.record out of useSyncExternalStore (see lib/auth.tsx).
export function usePref<K extends keyof Prefs>(name: K): Prefs[K] {
  return useSyncExternalStore(subscribe, () => cached[name])
}
