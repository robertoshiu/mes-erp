const LOOP_DURATION = 180 // seconds

export interface Clock {
  /** Seconds elapsed since boot */
  now(): number
  /** Seconds within current loop (0..180) */
  loopT(): number
  /** Monotonic loop counter (0, 1, 2, ...) */
  loopIndex(): number
  /** Start the clock. Call once after pre-roll. */
  start(): void
  /** Register callback for loop boundary crossings */
  onLoopBoundary(cb: (newLoopIndex: number) => void): () => void
  /** Clean up listeners */
  destroy(): void
}

export function createClock(): Clock {
  let t0 = 0
  let currentLoopIndex = 0
  let started = false
  const loopListeners: Set<(idx: number) => void> = new Set()

  function now(): number {
    if (!started) return 0
    return (performance.now() - t0) / 1000
  }

  function loopT(): number {
    return now() % LOOP_DURATION
  }

  function loopIndex(): number {
    return Math.floor(now() / LOOP_DURATION)
  }

  function checkLoopBoundary() {
    const idx = loopIndex()
    if (idx !== currentLoopIndex) {
      currentLoopIndex = idx
      loopListeners.forEach(cb => cb(idx))
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null

  function handleVisibility() {
    if (document.hidden || !started) return
    checkLoopBoundary()
  }

  function start() {
    t0 = performance.now()
    currentLoopIndex = 0
    started = true
    // Check for loop boundaries every 100ms
    intervalId = setInterval(checkLoopBoundary, 100)
    document.addEventListener('visibilitychange', handleVisibility)
  }

  function onLoopBoundary(cb: (newLoopIndex: number) => void): () => void {
    loopListeners.add(cb)
    return () => loopListeners.delete(cb)
  }

  function destroy() {
    if (intervalId) clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibility)
    loopListeners.clear()
  }

  return { now, loopT, loopIndex, start, onLoopBoundary, destroy }
}

export const LOOP_DURATION_S = LOOP_DURATION
