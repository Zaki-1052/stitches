// web/src/main.tsx — app entry: fonts, theme, router
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

import App from './App.tsx'
import TokensPage from './routes/TokensPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [{ path: 'tokens', element: <TokensPage /> }],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
