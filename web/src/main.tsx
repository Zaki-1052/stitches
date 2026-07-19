// web/src/main.tsx — app entry: fonts, theme, global iOS hygiene, auth, router.
import { StrictMode } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { QueryClientProvider } from '@tanstack/react-query'

import '@fontsource/baloo-2/600.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import './styles/theme.css'
import './styles/base.css'
import './styles/richtext.css'

import { AuthProvider } from './lib/auth.tsx'
import { initOutbox } from './lib/outbox.ts'
import { queryClient } from './features/shared/queryClient.ts'
import { ToastProvider } from './features/shared/toast.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AppShell } from './components/AppShell.tsx'
import { RouteErrorBoundary } from './components/RouteErrorBoundary.tsx'
import LoginPage from './routes/LoginPage.tsx'
import HomePage from './routes/HomePage.tsx'
import LibraryPage from './routes/LibraryPage.tsx'
import ProjectsPage from './routes/ProjectsPage.tsx'
import FriendsPage from './routes/FriendsPage.tsx'
import CounterPage from './routes/CounterPage.tsx'

// Module scope, not an effect: the persisted counter queue must flush on reopen even if no
// counter screen ever mounts (SPEC §11), and StrictMode double-invokes effects, not modules.
initOutbox()

// Route-level code splitting (4.2): dockless subpages load on demand. Their chunks are
// SW-precached after install, so lazy routes still open offline; the previous screen stays
// mounted while a module loads (RR7), so there's no blank flash. The dock tabs and the counter
// surface stay eager — cold open → counting in one tap.
const lazyPage = (load: () => Promise<{ default: ComponentType }>) => () =>
  load().then((m) => ({ Component: m.default }))

const router = createBrowserRouter([
  {
    // Router-root crash net: login, ProtectedRoute, and the dockless subpages (which have no
    // shared chrome worth preserving). Tab bodies get their own boundary below instead, so a
    // crash there keeps the header and dock alive.
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <AppShell />,
            children: [
              {
                ErrorBoundary: RouteErrorBoundary,
                children: [
                  { index: true, element: <HomePage /> },
                  { path: 'patterns', element: <LibraryPage /> },
                  { path: 'projects', element: <ProjectsPage /> },
                  { path: 'friends', element: <FriendsPage /> },
                  { path: 'tokens', lazy: lazyPage(() => import('./routes/TokensPage.tsx')) },
                ],
              },
            ],
          },
          // Dockless pushed subpages (the /settings BackBar pattern). The static 'new' segment
          // outranks ':id' in React Router's matching, so /patterns/new never hits the detail
          // route. /projects/:id is lazy too: the hero Count button deep-links straight to
          // /count, so detail is not on the one-tap counting path.
          { path: '/patterns/new', lazy: lazyPage(() => import('./routes/PatternFormPage.tsx')) },
          { path: '/patterns/search-ravelry', lazy: lazyPage(() => import('./routes/RavelrySearchPage.tsx')) },
          { path: '/patterns/:id', lazy: lazyPage(() => import('./routes/PatternDetailPage.tsx')) },
          { path: '/patterns/:id/edit', lazy: lazyPage(() => import('./routes/PatternFormPage.tsx')) },
          { path: '/projects/new', lazy: lazyPage(() => import('./routes/ProjectFormPage.tsx')) },
          { path: '/projects/:id', lazy: lazyPage(() => import('./routes/ProjectDetailPage.tsx')) },
          { path: '/projects/:id/edit', lazy: lazyPage(() => import('./routes/ProjectFormPage.tsx')) },
          { path: '/projects/:id/count', element: <CounterPage /> },
          { path: '/settings', lazy: lazyPage(() => import('./routes/SettingsPage.tsx')) },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
