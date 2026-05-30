import { useIsMobile } from '../../hooks/useMediaQuery'
import { ProjectSidebar } from './ProjectSidebar'
import { WebDavSettings } from './WebDavSettings'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const isMobile = useIsMobile()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-800 bg-slate-900 shadow-xl transition-transform duration-200 ease-out md:static md:z-auto md:w-56 md:shrink-0 md:translate-x-0 md:shadow-none ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-hidden={isMobile && !open ? true : undefined}
    >
      <ProjectSidebar onNavigate={onClose} />
      <WebDavSettings />
    </aside>
  )
}
