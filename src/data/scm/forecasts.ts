import { mulberry32 } from '../prng'
import type { Material } from '../erp/types'
import type { Forecast } from './types'

const FORECAST_SEED = 2030

// IBP-style time-bucket horizon (e.g. 8 weekly buckets). The Demand Planning
// grid tints the variance between buckets (forecast) and actuals (realized).
const NUM_BUCKETS = 8

/**
 * Generate one demand plan per FERT material: a deterministic forecast curve
 * (a base level with a mild seasonal swell + per-bucket jitter) and matching
 * actuals (the forecast nudged by a bounded variance so some buckets read over,
 * some under). Quantities are wafer-lot rounded (multiples of 25). Deterministic
 * via a per-material seeded PRNG.
 */
export function generateForecasts(materials: Material[]): Forecast[] {
  const ferts = materials.filter(m => m.type === 'FERT')
  const forecasts: Forecast[] = []

  ferts.forEach((fert, idx) => {
    // Per-material seed so curves differ but stay deterministic.
    const rng = mulberry32(FORECAST_SEED + idx * 7)

    const base = 100 + Math.floor(rng() * 12) * 25 // 100..375 in lot steps
    const buckets: number[] = []
    const actuals: number[] = []

    for (let b = 0; b < NUM_BUCKETS; b++) {
      // Gentle seasonal swell across the horizon + bounded jitter.
      const seasonal = 1 + 0.18 * Math.sin((b / NUM_BUCKETS) * Math.PI)
      const jitter = 0.9 + rng() * 0.2 // 0.9..1.1
      const forecast = Math.max(25, Math.round((base * seasonal * jitter) / 25) * 25)

      // Actuals deviate by +/-15% so the variance grid has both signs.
      const dev = 0.85 + rng() * 0.3 // 0.85..1.15
      const actual = Math.max(0, Math.round((forecast * dev) / 25) * 25)

      buckets.push(forecast)
      actuals.push(actual)
    }

    forecasts.push({
      materialNo: fert.materialNo,
      buckets,
      actuals,
    })
  })

  return forecasts
}

export { NUM_BUCKETS as FORECAST_BUCKETS }
