// web/src/main.tsx — app entry: fonts, theme, global iOS hygiene, auth, router.
import { StrictMode } from 'react'
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
import LoginPage from './routes/LoginPage.tsx'
import HomePage from './routes/HomePage.tsx'
import LibraryPage from './routes/LibraryPage.tsx'
import PatternDetailPage from './routes/PatternDetailPage.tsx'
import PatternFormPage from './routes/PatternFormPage.tsx'
import ProjectsPage from './routes/ProjectsPage.tsx'
import ProjectDetailPage from './routes/ProjectDetailPage.tsx'
import ProjectFormPage from './routes/ProjectFormPage.tsx'
import CounterPage from './routes/CounterPage.tsx'
import SettingsStub from './routes/SettingsStub.tsx'
import TokensPage from './routes/TokensPage.tsx'

// Module scope, not an effect: the persisted counter queue must flush on reopen even if no
// counter screen ever mounts (SPEC §11), and StrictMode double-invokes effects, not modules.
initOutbox()

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'patterns', element: <LibraryPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'tokens', element: <TokensPage /> },
        ],
      },
      // Dockless pushed subpages (the /settings BackBar pattern). The static 'new' segment
      // outranks ':id' in React Router's matching, so /patterns/new never hits the detail route.
      { path: '/patterns/new', element: <PatternFormPage /> },
      { path: '/patterns/:id', element: <PatternDetailPage /> },
      { path: '/patterns/:id/edit', element: <PatternFormPage /> },
      { path: '/projects/new', element: <ProjectFormPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/projects/:id/edit', element: <ProjectFormPage /> },
      { path: '/projects/:id/count', element: <CounterPage /> },
      { path: '/settings', element: <SettingsStub /> },
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
