// Pure normalization for the KPI radar panel. Maps each raw KPI metric onto a
// 0–100 "goodness" scale (higher = better) against a fixed target band, so
// mixed-unit metrics (%, wph, x, hours) plot comparably on one RadarChart.
// Frameworkless → unit-tested under the node env.

import type { KpiTickEvent } from '../../lib/events'

export interface RadarAxis {
  /** Axis label shown on the radar. */
  metric: string
  /** Normalized 0–100 score (clamped). */
  score: number
  /** Raw value (for tooltip). */
  raw: number
}

/** Linear normalize `v` from [lo, hi] onto 0–100, clamped to the band. */
export function normalizeMetric(v: number, lo: number, hi: number): number {
  if (!(hi > lo) || !Number.isFinite(v)) return 0
  const t = (v - lo) / (hi - lo)
  return Math.max(0, Math.min(100, t * 100))
}

/** Per-metric target band [lo, hi]; raw values clamp onto 0–100 within it. */
const BANDS = {
  oee: [0.4, 1.0], // 40%–100%
  yieldPct: [0.7, 1.0], // 70%–100%
  throughputUnitsPerHour: [0, 600], // 0–600 wph
  wipTurn: [0, 12], // 0–12 turns
  mtbfMinutes: [0, 1440], // 0–24h in minutes
} as const

/**
 * Build the 5-axis normalized radar payload (OEE / Yield / Throughput / WIP-turn /
 * MTBF) from a KPI snapshot. All axes are "up is good" so the polygon area reads as
 * overall health. Null snapshot → all-zero axes (stable shape pre-telemetry).
 */
export function buildKpiRadar(kpi: KpiTickEvent | null): RadarAxis[] {
  const v = (key: keyof typeof BANDS): number => (kpi ? (kpi[key] as number) : 0)
  return [
    { metric: 'OEE', raw: v('oee'), score: normalizeMetric(v('oee'), BANDS.oee[0], BANDS.oee[1]) },
    { metric: 'Yield', raw: v('yieldPct'), score: normalizeMetric(v('yieldPct'), BANDS.yieldPct[0], BANDS.yieldPct[1]) },
    {
      metric: 'Throughput',
      raw: v('throughputUnitsPerHour'),
      score: normalizeMetric(v('throughputUnitsPerHour'), BANDS.throughputUnitsPerHour[0], BANDS.throughputUnitsPerHour[1]),
    },
    { metric: 'WIP Turn', raw: v('wipTurn'), score: normalizeMetric(v('wipTurn'), BANDS.wipTurn[0], BANDS.wipTurn[1]) },
    { metric: 'MTBF', raw: v('mtbfMinutes'), score: normalizeMetric(v('mtbfMinutes'), BANDS.mtbfMinutes[0], BANDS.mtbfMinutes[1]) },
  ]
}
