// Pure aggregation helpers for the Shipments mode-split band + busiest-lanes
// RankBar. Deterministic (no random, no wall-clock) — derived entirely from the
// live shipment set + the lane lookup the screen already holds — so they unit-
// test under the node env.

import type { Shipment, LaneMode } from '../../data/scm/types'

/** Per-mode shipment counts for the mode-split DonutSpark trio. */
export interface ModeSplit {
  air: number
  sea: number
  truck: number
  total: number
}

/**
 * Count shipments by their lane's transport mode. A shipment whose lane is not
 * found in `modeByLane` is skipped (it cannot be attributed to a mode), so the
 * totals never invent a bucket.
 */
export function modeSplit(shipments: Shipment[], modeByLane: Map<string, LaneMode>): ModeSplit {
  let air = 0
  let sea = 0
  let truck = 0
  for (const s of shipments) {
    const mode = modeByLane.get(s.laneId)
    if (mode === 'air') air++
    else if (mode === 'sea') sea++
    else if (mode === 'truck') truck++
  }
  return { air, sea, truck, total: air + sea + truck }
}

/** One ranked from→to lane with its in-flight shipment count. */
export interface LaneRank {
  laneId: string
  label: string
  count: number
}

/**
 * Rank lanes by how many shipments are currently flying them. `nameOf` resolves
 * a node id to its display name; lanes are labeled "From → To". Ties break on the
 * label so the order is stable. Returns at most `top` entries.
 */
export function busiestLanes(
  shipments: Shipment[],
  nameOf: (id: string) => string,
  top = 5,
): LaneRank[] {
  // Aggregate count + remember the route endpoints per lane.
  const byLane = new Map<string, { from: string; to: string; count: number }>()
  for (const s of shipments) {
    const prev = byLane.get(s.laneId)
    if (prev) prev.count++
    else byLane.set(s.laneId, { from: s.fromNode, to: s.toNode, count: 1 })
  }
  const ranked: LaneRank[] = [...byLane.entries()].map(([laneId, v]) => ({
    laneId,
    label: `${nameOf(v.from)} → ${nameOf(v.to)}`,
    count: v.count,
  }))
  ranked.sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
  return ranked.slice(0, top)
}
