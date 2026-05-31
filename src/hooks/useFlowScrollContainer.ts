import { useCallback, useRef, type RefObject } from 'react'

interface FlowScrollContainerOptions {
  /** 阻止 React Flow 画布接管滚轮/触摸 */
  active: boolean
  /** 桌面端悬停滚轮 */
  wheel: boolean
}

interface FlowScrollContainerResult {
  ref: RefObject<HTMLDivElement | null>
  onTouchStartCapture: (event: React.TouchEvent<HTMLDivElement>) => void
  onTouchMoveCapture: (event: React.TouchEvent<HTMLDivElement>) => void
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void
}

/** 让节点内 overflow 区域在 React Flow 画布上可滚（触屏滑动 / 桌面滚轮） */
export function useFlowScrollContainer({
  active,
  wheel,
}: FlowScrollContainerOptions): FlowScrollContainerResult {
  const ref = useRef<HTMLDivElement>(null)

  const onTouchStartCapture = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!active) return
      event.stopPropagation()
    },
    [active],
  )

  const onTouchMoveCapture = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!active) return
      event.stopPropagation()
    },
    [active],
  )

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!active || !wheel) return
      event.stopPropagation()
    },
    [active, wheel],
  )

  return {
    ref,
    onTouchStartCapture,
    onTouchMoveCapture,
    onWheel,
  }
}
