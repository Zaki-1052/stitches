// web/src/main.tsx — app entry: fonts, theme, global iOS hygiene, auth, router.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import '@fontsource/baloo-2/600.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import './styles/theme.css'
import './styles/base.css'

import { AuthProvider } from './lib/auth.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AppShell } from './components/AppShell.tsx'
import LoginPage from './routes/LoginPage.tsx'
import HomePage from './routes/HomePage.tsx'
import LibraryStub from './routes/LibraryStub.tsx'
import ProjectsStub from './routes/ProjectsStub.tsx'
import SettingsStub from './routes/SettingsStub.tsx'
import TokensPage from './routes/TokensPage.tsx'

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
          { path: 'patterns', element: <LibraryStub /> },
          { path: 'projects', element: <ProjectsStub /> },
          { path: 'tokens', element: <TokensPage /> },
        ],
      },
      { path: '/settings', element: <SettingsStub /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
