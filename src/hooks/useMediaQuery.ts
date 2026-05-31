import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = () => setMatches(media.matches)
    listener()
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}

/** 主输入为触屏（手机 / iPad），阅读模式 A 区用手指滑动、隐藏滚动条 */
export function usePrefersTouchScroll() {
  const coarseNoHover = useMediaQuery('(hover: none) and (pointer: coarse)')
  const narrowCoarse = useMediaQuery('(max-width: 1024px) and (pointer: coarse)')
  return coarseNoHover || narrowCoarse
}
