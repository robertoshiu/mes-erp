// Pure rolling-window fold of alarm.raised events into time buckets by severity,
// feeding the stacked AreaChart. Framework-free so it unit-tests under node env.

export type AlarmSeverity = 'critical' | 'major' | 'minor'

export interface SeverityBucket {
  /** Bucket's right-edge time in seconds (loop time). */
  t: number
  critical: number
  major: number
  minor: number
}

interface AlarmLike {
  t: number
  severity: AlarmSeverity
}

/**
 * Bin alarms into `bucketCount` equal time slices spanning `[now - windowSec, now]`.
 *
 * - `now` is the right edge of the window (typically the latest loop time, or a
 *   fixed value in tests — never the wall clock).
 * - Each bucket carries per-severity counts; the chart stacks them.
 * - Alarms outside the window are dropped. Determinism: identical inputs always
 *   yield identical buckets (no PRNG, no Date.now).
 */
export function foldAlarmsBySeverity(
  alarms: readonly AlarmLike[],
  now: number,
  windowSec: number,
  bucketCount: number,
): SeverityBucket[] {
  const n = Math.max(1, Math.floor(bucketCount))
  const span = Math.max(1e-6, windowSec)
  const slice = span / n
  const start = now - span

  const buckets: SeverityBucket[] = Array.from({ length: n }, (_, i) => ({
    t: start + (i + 1) * slice,
    critical: 0,
    major: 0,
    minor: 0,
  }))

  for (const a of alarms) {
    if (a.t < start || a.t > now) continue
    // Index by distance from the window start; clamp the right edge into the
    // last bucket so an alarm exactly at `now` is counted.
    let idx = Math.floor((a.t - start) / slice)
    if (idx < 0) idx = 0
    if (idx >= n) idx = n - 1
    buckets[idx][a.severity] += 1
  }

  return buckets
}

/** Sum of all alarms across all buckets (window throughput). */
export function windowTotal(buckets: readonly SeverityBucket[]): number {
  return buckets.reduce((s, b) => s + b.critical + b.major + b.minor, 0)
}
