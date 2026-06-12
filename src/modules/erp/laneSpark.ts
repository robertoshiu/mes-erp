// Pure helpers for the Cockpit lane sparklines — a fixed-width rolling history
// of per-lane event activity. Framework-free so they unit-test under node env.
// Deterministic: callers feed an increment; no randomness, no wall-clock.

export const SPARK_BUCKETS = 12

/** Append `amount` activity into the newest bucket of a fixed-width history
 *  ring (oldest→newest). Returns a NEW array (immutable for reducer state). */
export function pushSpark(history: number[], amount = 1): number[] {
  const next = history.length === SPARK_BUCKETS ? history.slice() : emptySpark()
  next[SPARK_BUCKETS - 1] += amount
  return next
}

/** Advance the history by one bucket (shift left, open a fresh 0 bucket at the
 *  newest end). Drives a time-based scroll independent of event arrival. */
export function rollSpark(history: number[]): number[] {
  const src = history.length === SPARK_BUCKETS ? history : emptySpark()
  return [...src.slice(1), 0]
}

export function emptySpark(): number[] {
  return new Array(SPARK_BUCKETS).fill(0)
}

/** Build SVG polyline points for a sparkline within a w×h box. A flat/empty
 *  history pins to the baseline. Returned as an "x,y x,y …" string. */
export function sparkPoints(history: number[], w: number, h: number, pad = 1): string {
  const n = history.length
  if (n === 0) return ''
  const max = Math.max(1, ...history)
  const innerW = Math.max(1, w - pad * 2)
  const innerH = Math.max(1, h - pad * 2)
  const step = n > 1 ? innerW / (n - 1) : 0
  return history
    .map((v, i) => {
      const x = pad + i * step
      const y = pad + innerH - (v / max) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
