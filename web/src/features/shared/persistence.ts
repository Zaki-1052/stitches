// web/src/features/shared/persistence.ts — query-cache persistence (ADDONS §3.2): the cache
// survives app kills via IndexedDB (idb-keyval, its own DB — kept-file blobs live in a separate
// store so megabyte binaries never ride a cache rehydrate). PersistQueryClientProvider
// (main.tsx) gates queries until restore completes, so a cold offline open rehydrates before
// anything tries to fetch.
//   - buster __APP_VERSION__: every release invalidates the persisted blob wholesale, so
//     persisted shapes never drift against new code.
//   - maxAge 30 d: persistence is about surviving kills; freshness stays staleTime's job.
//   - fileToken (a ~2 min credential) is never dehydrated, and defaultShouldDehydrateQuery
//     keeps the success-only default. The mutation cache stays unpersisted (the default —
//     don't flip it); the counter outbox already survives kills by design.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { createStore, del, get, set } from 'idb-keyval'

const store = createStore('stitches-query-cache', 'cache')

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, store).then((value) => value ?? null),
    setItem: (key, value) => set(key, value, store),
    removeItem: (key) => del(key, store),
  },
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  buster: __APP_VERSION__,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== 'fileToken',
  },
}
