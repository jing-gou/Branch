export const READONLY_MODE_KEY = 'branch-readonly-mode'

export function loadReadOnlyMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(READONLY_MODE_KEY) === 'true'
}

export function saveReadOnlyMode(enabled: boolean): void {
  localStorage.setItem(READONLY_MODE_KEY, String(enabled))
}
