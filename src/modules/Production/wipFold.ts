// Pure WIP-by-route-step aggregation for the Production histogram strip.
// Folds the live lot→step map (seeded from initial lot data, advanced by
// lot.move events) into per-step lot counts. Framework-free so it unit-tests
// under the node env.

export interface WipStepBucket {
  /** Route step index (0-based). */
  step: number
  /** Number of active lots currently sitting at this step. */
  count: number
}

interface WipLotLike {
  lotId: string
  currentStep: number
  totalSteps: number
  status: 'in-process' | 'hold' | 'complete' | 'queued'
}

/**
 * Bucket active lots by their current route step into a fixed-width histogram.
 *
 * - `stepOverrides` carries the live step per lot (from lot.move fold); a lot
 *   missing from the map falls back to its seeded `currentStep`.
 * - Completed lots are excluded (they have left the line — WIP is work *in
 *   process*).
 * - The result is always `buckets` entries wide (steps 0..buckets-1) so the
 *   strip renders a stable column count regardless of which steps are occupied.
 * - Steps beyond the bucket window are clamped into the last bucket so no lot
 *   silently disappears from the total.
 */
export function foldWipByStep(
  lots: readonly WipLotLike[],
  stepOverrides: Record<string, number>,
  buckets: number,
): WipStepBucket[] {
  const width = Math.max(1, Math.floor(buckets))
  const counts = new Array<number>(width).fill(0)

  for (const lot of lots) {
    if (lot.status === 'complete') continue
    const raw = stepOverrides[lot.lotId] ?? lot.currentStep
    if (!Number.isFinite(raw)) continue
    const step = Math.max(0, Math.min(width - 1, Math.floor(raw)))
    counts[step] += 1
  }

  return counts.map((count, step) => ({ step, count }))
}

/** Largest bucket count (≥1) — the histogram's y-scale. */
export function wipPeak(buckets: readonly WipStepBucket[]): number {
  return Math.max(1, ...buckets.map(b => b.count))
}
