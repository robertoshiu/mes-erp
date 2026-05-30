// Shared MRP coverage selector. The single definition of "material coverage"
// and "how many materials are short", used by both the MRP screen
// (modules/erp/Mrp.tsx) and the sidebar shortages badge (App.tsx) so the two
// never disagree.

import type { InventoryRow, Material } from './types'

/** Number of forward time buckets to project coverage over. */
export const BUCKET_COUNT = 5
export const BUCKETS = Array.from({ length: BUCKET_COUNT }, (_, i) => `B${i + 1}`)

export interface CoverageRow {
  materialNo: string
  description: string
  plant: string
  storageLoc: string
  baseUoM: string
  leadTimeDays: number
  onHand: number
  committed: number
  available: number
  /** Steady per-bucket burn (deterministic). */
  burn: number
  /** Projected on-hand at the end of each bucket B1..B5. */
  projected: number[]
  /** True if any bucket goes to/below zero. */
  shortage: boolean
  /** Index of the first bucket that breaches zero, or -1. */
  firstBreach: number
}

/**
 * Deterministically derive a per-bucket demand "burn" from a row's own numbers.
 * No randomness, no wall-clock: a longer lead time spreads the committed demand
 * over more buckets (slower burn); a shorter lead time concentrates it.
 */
export function deriveBurn(committed: number, leadTimeDays: number): number {
  const horizon = Math.max(1, Math.min(leadTimeDays, BUCKET_COUNT))
  // Spread committed demand across the lead-time horizon, but never less than a
  // token trickle so every row time-phases visibly.
  return Math.max(committed / horizon, committed > 0 ? 0.5 : 0)
}

/** Build the time-phased coverage matrix from inventory + material master. */
export function buildCoverage(
  inventory: InventoryRow[],
  materials: Material[],
): CoverageRow[] {
  const matByNo = new Map(materials.map(m => [m.materialNo, m]))

  return inventory.map(row => {
    const mat = matByNo.get(row.materialNo)
    const leadTimeDays = mat?.leadTimeDays ?? 1
    const baseUoM = mat?.baseUoM ?? 'EA'
    const burn = deriveBurn(row.committed, leadTimeDays)

    const projected: number[] = []
    let running = row.onHand
    let firstBreach = -1
    for (let i = 0; i < BUCKET_COUNT; i++) {
      running = running - burn
      projected.push(running)
      if (running <= 0 && firstBreach === -1) firstBreach = i
    }

    return {
      materialNo: row.materialNo,
      description: row.description,
      plant: row.plant,
      storageLoc: row.storageLoc,
      baseUoM,
      leadTimeDays,
      onHand: row.onHand,
      committed: row.committed,
      available: row.available,
      burn,
      projected,
      shortage: firstBreach !== -1,
      firstBreach,
    }
  })
}

/** Single source of truth for "how many materials are short". */
export function countShortages(inventory: InventoryRow[], materials: Material[]): number {
  return buildCoverage(inventory, materials).filter(r => r.shortage).length
}
