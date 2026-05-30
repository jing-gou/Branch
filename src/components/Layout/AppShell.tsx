import { useState } from 'react'
import { Canvas } from '../Canvas/Canvas'
import { Sidebar } from '../Sidebar/Sidebar'
import { PRODUCT_NAME } from '../../lib/brand'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label={`关闭 ${PRODUCT_NAME} 侧栏`}
          className="fixed inset-0 z-40 bg-black/55 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Canvas onOpenSidebar={() => setSidebarOpen(true)} />
      </main>
    </div>
  )
}
