// Pure computations for the Demand Planning hero seasonality heatmap + per-SKU
// forecast-accuracy bullets. Deterministic — derived entirely from the screen's
// existing forecast/actual plan data (no random, no wall-clock) — so they unit-
// test under the node env.

/** A material's plan: forecast buckets + realized actuals (same shape the screen
 *  folds live overlays onto). */
export interface DemandPlan {
  materialNo: string
  buckets: number[]
  actuals: number[]
}

/** One cell of the seasonality matrix: a material's forecast in one bucket,
 *  normalized 0..1 against that material's own peak bucket so the color reads as
 *  "this SKU's seasonal shape" rather than absolute magnitude. */
export interface HeatCell {
  /** 0..1 intensity vs. the row's peak bucket. */
  intensity: number
  /** Raw forecast quantity for the bucket. */
  qty: number
}

export interface HeatRow {
  materialNo: string
  /** Plan-window total forecast volume (drives the top-SKU ranking). */
  total: number
  cells: HeatCell[]
}

/**
 * Build the seasonality heatmap: the top-N materials by total forecast volume,
 * each row's cells normalized to that row's peak forecast bucket. Rows are sorted
 * by total volume desc (ties on materialNo) so the matrix always leads with the
 * highest-volume SKUs. Stable + pure (never mutates the input).
 */
export function seasonalityMatrix(plans: DemandPlan[], topN = 8): HeatRow[] {
  const rows: HeatRow[] = plans.map(p => {
    const peak = p.buckets.reduce((m, q) => Math.max(m, q), 0)
    const total = p.buckets.reduce((s, q) => s + q, 0)
    return {
      materialNo: p.materialNo,
      total,
      cells: p.buckets.map(q => ({ intensity: peak > 0 ? Math.max(0, q) / peak : 0, qty: q })),
    }
  })
  return [...rows]
    .sort((a, b) => (b.total - a.total) || a.materialNo.localeCompare(b.materialNo))
    .slice(0, topN)
}

/**
 * Per-SKU forecast accuracy as a 0..100 percentage (MAPE-style): 100 − mean
 * absolute percentage error of actuals vs. forecast across the plan window,
 * floored at 0. A material with zero forecast volume reports 0 (undefined
 * accuracy treated as the at-risk floor).
 */
export function forecastAccuracy(plan: DemandPlan): number {
  let fcst = 0
  let absErr = 0
  for (let i = 0; i < plan.buckets.length; i++) {
    const f = plan.buckets[i]
    const a = plan.actuals[i] ?? 0
    fcst += f
    absErr += Math.abs(a - f)
  }
  if (fcst <= 0) return 0
  return Math.max(0, 100 - (absErr / fcst) * 100)
}
