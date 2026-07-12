// web/src/lib/pb.ts — the single PocketBase client for the app (SPEC §6, §12).
// Same-origin base URL: the Vite dev proxy (and production) route /api to PocketBase, so the app
// is same-origin and there is no CORS anywhere (SPEC §4). The SDK persists the auth token in
// localStorage; all server state flows through this one instance.
import PocketBase from 'pocketbase'

export const pb = new PocketBase(window.location.origin)
