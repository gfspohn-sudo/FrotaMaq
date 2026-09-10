import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-gray-50 pb-20">
      <Outlet />
      <BottomNav />
    </div>
  )
}
