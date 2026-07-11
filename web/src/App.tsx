// web/src/App.tsx — root layout shell; the real header + dock arrive in Session 0.2
import { Outlet } from 'react-router'

export default function App() {
  return (
    <div className="min-h-dvh bg-base-200 font-sans text-base-content">
      <Outlet />
    </div>
  )
}
