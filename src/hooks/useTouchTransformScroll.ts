import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface TouchTransformScrollResult {
  viewportRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  contentStyle: React.CSSProperties
}

/** 触屏阅读：用 translate 模拟滚动，绕过 iOS + CSS transform 下 overflow 失效 */
export function useTouchTransformScroll(active: boolean): TouchTransformScrollResult {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  offsetRef.current = offset

  const getMaxScroll = useCallback(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return 0
    return Math.max(0, content.scrollHeight - viewport.clientHeight)
  }, [])

  const clampOffset = useCallback(
    (value: number) => {
      const max = getMaxScroll()
      return Math.min(max, Math.max(0, value))
    },
    [getMaxScroll],
  )

  useLayoutEffect(() => {
    if (!active) return
    setOffset((prev) => clampOffset(prev))
  }, [active, clampOffset])

  useEffect(() => {
    if (!active) return
    const viewport = viewportRef.current
    if (!viewport) return

    let touch: { startY: number; startOffset: number } | null = null

    const isInside = (target: EventTarget | null) =>
      target instanceof Node && viewport.contains(target)

    const onTouchStart = (event: TouchEvent) => {
      if (!isInside(event.target) || event.touches.length !== 1) return
      touch = {
        startY: event.touches[0].clientY,
        startOffset: offsetRef.current,
      }
      event.stopPropagation()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1) return
      const deltaY = touch.startY - event.touches[0].clientY
      setOffset(clampOffset(touch.startOffset + deltaY))
      event.preventDefault()
      event.stopPropagation()
    }

    const onTouchEnd = () => {
      touch = null
    }

    const capture = { capture: true, passive: false } as const
    document.addEventListener('touchstart', onTouchStart, capture)
    document.addEventListener('touchmove', onTouchMove, capture)
    document.addEventListener('touchend', onTouchEnd, capture)
    document.addEventListener('touchcancel', onTouchEnd, capture)

    return () => {
      document.removeEventListener('touchstart', onTouchStart, capture)
      document.removeEventListener('touchmove', onTouchMove, capture)
      document.removeEventListener('touchend', onTouchEnd, capture)
      document.removeEventListener('touchcancel', onTouchEnd, capture)
    }
  }, [active, clampOffset])

  useEffect(() => {
    if (!active) return
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport) return

    const sync = () => setOffset((prev) => clampOffset(prev))
    const observer = new ResizeObserver(sync)
    observer.observe(viewport)
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [active, clampOffset])

  return {
    viewportRef,
    contentRef,
    contentStyle: {
      transform: `translate3d(0, ${-offset}px, 0)`,
      willChange: 'transform',
    },
  }
}
