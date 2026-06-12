import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { tweenValue } from '@/lib/tween'

interface AnimatedNumberProps {
  /** Target value; transitions are animated whenever this changes. */
  value: number
  /** Format the (tweened) number for display. Defaults to a rounded integer. */
  format?: (n: number) => string
  className?: string
}

const DURATION = 600

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** rAF count-up to a new value (~600ms easeOutCubic). Snaps instantly under
 *  prefers-reduced-motion. tabular-nums so digits don't jitter mid-tween. */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const from = fromRef.current
    if (from === value) return
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const next = tweenValue(from, value, elapsed, DURATION)
      setDisplay(next)
      if (elapsed < DURATION) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
        setDisplay(value)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value])

  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString())
  return <span className={cn('tabular-nums', className)}>{fmt(display)}</span>
}
