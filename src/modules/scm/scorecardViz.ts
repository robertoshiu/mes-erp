// Pure scoring helpers for the Supplier Scorecards podium band + drill-in radar.
// Deterministic — derived from the live scorecard metrics only (no random, no
// wall-clock) — so they unit-test under the node env.

import type { SupplierScorecard } from '../../data/scm/types'

// Normalization bounds: lead-time is mapped onto a 0..100 "shorter-is-better"
// score against a worst-case horizon so all three axes share one scale.
const LEAD_FLOOR = 2
const LEAD_CEILING = 45

/** Map a supplier's avg lead days onto a 0..100 score (short lead → high score). */
export function leadScore(avgLeadDays: number): number {
  const clamped = Math.max(LEAD_FLOOR, Math.min(LEAD_CEILING, avgLeadDays))
  return ((LEAD_CEILING - clamped) / (LEAD_CEILING - LEAD_FLOOR)) * 100
}

/**
 * Composite supplier score 0..100: the equal-weighted mean of on-time %,
 * quality %, and the normalized lead-time score. Rounded to one decimal.
 */
export function compositeScore(s: SupplierScorecard): number {
  const composite = (s.onTimePct + s.qualityPct + leadScore(s.avgLeadDays)) / 3
  return Math.round(composite * 10) / 10
}

/** Three normalized 0..100 axes for the drill-in radar. */
export interface RadarAxis {
  axis: string
  value: number
}

export function radarAxes(s: SupplierScorecard): RadarAxis[] {
  return [
    { axis: 'On-Time', value: Math.round(s.onTimePct) },
    { axis: 'Quality', value: Math.round(s.qualityPct) },
    { axis: 'Lead', value: Math.round(leadScore(s.avgLeadDays)) },
  ]
}

/** One podium entry: a top-ranked supplier with its composite score. */
export interface PodiumEntry {
  bpNo: string
  name: string
  score: number
}

/**
 * Rank suppliers by composite score, returning the top `n`. Ties break on name
 * then bpNo so the podium order is stable. Pure (never mutates the input).
 */
export function podium(scorecards: SupplierScorecard[], n = 3): PodiumEntry[] {
  return scorecards
    .map(s => ({ bpNo: s.bpNo, name: s.name, score: compositeScore(s) }))
    .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name) || a.bpNo.localeCompare(b.bpNo))
    .slice(0, n)
}
