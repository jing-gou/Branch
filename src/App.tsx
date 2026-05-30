import { AppShell } from './components/Layout/AppShell'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePersistence } from './hooks/usePersistence'

function App() {
  usePersistence()
  useKeyboardShortcuts()

  return <AppShell />
}

export default App
