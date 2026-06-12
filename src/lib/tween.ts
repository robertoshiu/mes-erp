// Pure tween/easing helpers for rAF-driven number animations (AnimatedNumber).
// Kept framework-free so they unit-test under the node env.

/** easeOutCubic: fast-out, gentle settle — the house curve for count-ups. */
export function easeOutCubic(t: number): number {
  const c = clamp01(t)
  return 1 - Math.pow(1 - c, 3)
}

/** Clamp a raw progress value into [0, 1]. */
export function clamp01(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

/**
 * Interpolate between `from` and `to` for an elapsed time within `duration`,
 * applying `ease`. `elapsed >= duration` (or duration <= 0) snaps to `to`.
 */
export function tweenValue(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
  ease: (t: number) => number = easeOutCubic,
): number {
  if (duration <= 0) return to
  const progress = ease(clamp01(elapsed / duration))
  return from + (to - from) * progress
}
