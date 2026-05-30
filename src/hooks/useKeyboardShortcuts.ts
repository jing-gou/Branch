import { useEffect } from 'react'
import { useConversationStore } from '../store/conversationStore'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (isTyping) return

      const isMod = event.ctrlKey || event.metaKey
      if (!isMod) return

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        useConversationStore.getState().undo()
        return
      }

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        useConversationStore.getState().redo()
        return
      }

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        useConversationStore.getState().redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
