import { useCallback, useEffect, useRef, type RefObject } from 'react'

interface FlowScrollContainerOptions {
  /** 阻止 React Flow 画布接管滚轮/触摸 */
  active: boolean
  /** 桌面端悬停滚轮 */
  wheel: boolean
}

interface FlowScrollContainerResult {
  ref: RefObject<HTMLDivElement | null>
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void
}

interface TouchScrollState {
  startY: number
  startScrollTop: number
}

/** 让节点内 overflow 区域在 React Flow 画布上可滚（触屏滑动 / 桌面滚轮） */
export function useFlowScrollContainer({
  active,
  wheel,
}: FlowScrollContainerOptions): FlowScrollContainerResult {
  const ref = useRef<HTMLDivElement>(null)
  const touchRef = useRef<TouchScrollState | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return

    const canScroll = () => el.scrollHeight > el.clientHeight + 1

    const isInside = (target: EventTarget | null) =>
      target instanceof Node && el.contains(target)

    const onTouchStart = (event: TouchEvent) => {
      if (!isInside(event.target) || event.touches.length !== 1) return
      if (!canScroll()) return

      touchRef.current = {
        startY: event.touches[0].clientY,
        startScrollTop: el.scrollTop,
      }
      event.stopPropagation()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!touchRef.current || event.touches.length !== 1) return
      if (!canScroll()) return

      const deltaY = touchRef.current.startY - event.touches[0].clientY
      el.scrollTop = touchRef.current.startScrollTop + deltaY

      event.preventDefault()
      event.stopPropagation()
    }

    const onTouchEnd = () => {
      touchRef.current = null
    }

    // document capture：早于 React Flow pane 上的 d3 监听器
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
  }, [active])

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!active || !wheel) return
      event.stopPropagation()
    },
    [active, wheel],
  )

  return {
    ref,
    onWheel,
  }
}
