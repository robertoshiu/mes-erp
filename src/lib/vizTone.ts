// Shared viz-tone mapping for the micro-viz primitives (Heatbar, SparkRing, …).
// Pure ratio→tone logic, framework-free so it unit-tests under the node env.
import { sem, brand } from './tokens'

/** Tonal vocabulary shared across the inline visualization cells. */
export type VizTone = 'accent' | 'success' | 'warn' | 'critical'

/**
 * Map a fill ratio (value/max) to a semantic tone for `tone:'auto'` cells:
 * ≥0.66 → success, ≥0.33 → warn, else critical. Non-finite ratios fall back to
 * critical (treated as the empty/at-risk floor).
 */
export function autoTone(ratio: number): VizTone {
  if (!Number.isFinite(ratio)) return 'critical'
  if (ratio >= 0.66) return 'success'
  if (ratio >= 0.33) return 'warn'
  return 'critical'
}

/** Resolve a VizTone to its hex color (mirrors the index.css palette). */
export function toneColor(tone: VizTone): string {
  switch (tone) {
    case 'success': return sem.success
    case 'warn': return sem.warn
    case 'critical': return sem.critical
    case 'accent': return brand.primary
  }
}

/**
 * Resolve an effective color for a cell: 'auto' derives a tone from the ratio,
 * any explicit tone resolves directly.
 */
export function resolveToneColor(tone: VizTone | 'auto', ratio: number): string {
  return toneColor(tone === 'auto' ? autoTone(ratio) : tone)
}
