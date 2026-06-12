// Hero coverage-heatmap computation for the MRP screen. Pure + deterministic —
// derived entirely from the CoverageRow[] the screen already builds (no random,
// no wall-clock), so it unit-tests under the node env.

import type { CoverageRow } from '../../data/erp/coverage'

/** A single heatmap cell: projected on-hand for one material in one bucket,
 *  normalized to a 0..1 coverage intensity against that material's burn. */
export interface MatrixCell {
  /** 0..1 — 1 = comfortably covered, 0 = fully depleted/at-or-below zero. */
  intensity: number
  /** Raw projected on-hand at the end of the bucket. */
  projected: number
  /** True when projected on-hand is at or below zero (a breach). */
  breach: boolean
}

/** One material row of the coverage matrix (top-N selection). */
export interface MatrixRow {
  materialNo: string
  description: string
  shortage: boolean
  cells: MatrixCell[]
}

/**
 * Normalize a projected on-hand to a 0..1 coverage intensity. We scale against
 * one bucket's burn so "how many buckets of cover remain" reads consistently
 * across materials of very different magnitudes: ≥2 buckets of cover saturates
 * to 1, a breach (≤0) floors at 0, in between scales linearly. When burn is 0
 * (no demand) any positive stock is fully covered.
 */
export function coverageIntensity(projected: number, burn: number): number {
  if (projected <= 0) return 0
  if (burn <= 0) return 1
  const bucketsOfCover = projected / burn
  return Math.max(0, Math.min(1, bucketsOfCover / 2))
}

/**
 * Pick the top-N materials for the hero heatmap. Shortage rows first (worst —
 * earliest breach — ahead), then the remaining rows by tightest coverage so the
 * matrix always leads with the materials that need attention. Stable + pure.
 */
export function buildMatrix(coverage: CoverageRow[], topN = 12): MatrixRow[] {
  const ranked = [...coverage].sort((a, b) => {
    // Shortages always sort ahead of covered rows.
    if (a.shortage !== b.shortage) return a.shortage ? -1 : 1
    if (a.shortage && b.shortage) {
      // Earliest breach is most urgent.
      if (a.firstBreach !== b.firstBreach) return a.firstBreach - b.firstBreach
    }
    // Otherwise: tightest final-bucket coverage first.
    const aTail = a.projected[a.projected.length - 1] ?? 0
    const bTail = b.projected[b.projected.length - 1] ?? 0
    if (aTail !== bTail) return aTail - bTail
    return a.materialNo.localeCompare(b.materialNo)
  })

  return ranked.slice(0, topN).map(row => ({
    materialNo: row.materialNo,
    description: row.description,
    shortage: row.shortage,
    cells: row.projected.map(p => ({
      intensity: coverageIntensity(p, row.burn),
      projected: p,
      breach: p <= 0,
    })),
  }))
}

/** A point on the aggregate shortage-projection strip: total projected deficit
 *  (sum of negative projected on-hand) across all materials, per bucket. */
export interface ShortagePoint {
  bucket: string
  /** Positive number = total units short across the book in that bucket. */
  shortfall: number
}

/** Aggregate per-bucket shortfall across every material — feeds the AreaChart. */
export function shortageProjection(
  coverage: CoverageRow[],
  buckets: string[],
): ShortagePoint[] {
  return buckets.map((bucket, i) => {
    let shortfall = 0
    for (const row of coverage) {
      const p = row.projected[i]
      if (p !== undefined && p < 0) shortfall += -p
    }
    return { bucket, shortfall: Math.round(shortfall) }
  })
}
