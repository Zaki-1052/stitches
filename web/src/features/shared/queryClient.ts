// web/src/features/shared/queryClient.ts — the app's single QueryClient (SPEC §12: all server
// state lives in TanStack Query over the PB singleton). Short staleTime keeps back-navigation
// instant from cache while windows-refocus still refreshes a four-user app's cheap queries.
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
