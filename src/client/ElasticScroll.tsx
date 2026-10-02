import { useEffect, useRef, type ComponentProps } from 'react'
import css from './sidebar.module.css'

/** Keep native scrolling and its offsets; only pull the content beyond an edge. */
export function ElasticScroll({ children, ...props }: ComponentProps<'div'>) {
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = boxRef.current!
    const content = contentRef.current!
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let offset = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let touch: { x: number; y: number } | undefined
    const release = () => {
      clearTimeout(timer)
      offset = 0
      content.style.transition = ''
      content.style.transform = ''
    }
    const pull = (delta: number): boolean => {
      if (reducedMotion?.matches || box.clientHeight === 0 || delta === 0) return false
      const atEdge = delta < 0 ? box.scrollTop <= 0 : box.scrollTop + box.clientHeight >= box.scrollHeight - 1
      if (!atEdge) { release(); return false }
      clearTimeout(timer)
      offset = Math.max(-36, Math.min(36, offset - delta * 0.22))
      content.style.transition = 'none'
      content.style.transform = `translateY(${offset}px)`
      return true
    }
    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 34 : event.deltaMode === 2 ? box.clientHeight : 1)
      if (pull(delta)) {
        event.preventDefault()
        timer = setTimeout(release, 100)
      }
    }
    const touchStart = (event: TouchEvent) => {
      release()
      const point = event.touches.length === 1 ? event.touches[0] : undefined
      touch = point === undefined ? undefined : { x: point.clientX, y: point.clientY }
    }
    const touchMove = (event: TouchEvent) => {
      const point = event.touches.length === 1 ? event.touches[0] : undefined
      if (point === undefined || touch === undefined) { touch = undefined; release(); return }
      const delta = touch.y - point.clientY
      const horizontal = Math.abs(touch.x - point.clientX) > Math.abs(delta)
      touch = { x: point.clientX, y: point.clientY }
      if (!event.defaultPrevented && !horizontal && pull(delta)) event.preventDefault()
    }
    const touchEnd = () => { touch = undefined; release() }
    box.addEventListener('wheel', wheel, { passive: false })
    box.addEventListener('touchstart', touchStart, { passive: true })
    box.addEventListener('touchmove', touchMove, { passive: false })
    box.addEventListener('touchend', touchEnd)
    box.addEventListener('touchcancel', touchEnd)
    reducedMotion?.addEventListener('change', release)
    return () => {
      release()
      box.removeEventListener('wheel', wheel)
      box.removeEventListener('touchstart', touchStart)
      box.removeEventListener('touchmove', touchMove)
      box.removeEventListener('touchend', touchEnd)
      box.removeEventListener('touchcancel', touchEnd)
      reducedMotion?.removeEventListener('change', release)
    }
  }, [])
  return <div {...props} ref={boxRef}>
    {/* Clip translated overflow so pulling cannot change scrollHeight or trigger history paging. */}
    <div className={css.gitScrollClip}><div ref={contentRef} className={css.gitScrollContent}>{children}</div></div>
  </div>
}
