// Deterministic order-timeline (Gantt) model for the Production Orders hero.
// ProductionOrder carries no date fields, so a believable schedule is derived
// deterministically from each order's status + a cyrb53(orderNo) hash (mirroring
// the SalesOrders ATP pattern): no Math.random, no Date.now — stable across
// reloads. All positions are on a normalized 0..1 time axis; "today" is a fixed
// reference the renderer turns into a vertical line.

import { cyrb53 } from '../../data/prng'
import type { ProductionOrder, ProdOrderStatus } from '../../data/erp/types'

/** Where "now" sits on the 0..1 axis — past on the left, horizon on the right. */
export const TODAY_REF = 0.46

export interface GanttBar {
  orderNo: string
  description: string
  status: ProdOrderStatus
  /** Bar start on the 0..1 axis. */
  start: number
  /** Bar end on the 0..1 axis (always > start). */
  end: number
}

/** Stable 0..1 roll for an order from a salted hash. */
function roll(orderNo: string, salt: number): number {
  return (cyrb53(orderNo, salt) % 1000) / 1000
}

/**
 * Place one order on the time axis. Status anchors the bar relative to "today":
 *   Completed → finished in the past (ends before today)
 *   InProcess → straddles today (started in the past, ends in the near future)
 *   Released  → about to start (starts near today, runs forward)
 *   Created   → planned further out (starts after today)
 * Duration scales mildly with target qty (bigger orders run longer) plus a
 * hash jitter so bars don't all share an edge.
 */
export function ganttBarFor(order: ProductionOrder): GanttBar {
  const r1 = roll(order.orderNo, 3)
  const r2 = roll(order.orderNo, 9)
  // Base duration 0.10..0.26 of the axis, lengthened a touch by larger qty.
  const qtyFactor = Math.min(0.08, Math.log10(Math.max(10, order.targetQty)) * 0.012)
  const dur = 0.1 + r1 * 0.16 + qtyFactor

  let start: number
  switch (order.status) {
    case 'Completed':
      // Entirely in the past: end before today, by a hash-stable margin.
      start = TODAY_REF - dur - 0.04 - r2 * 0.26
      break
    case 'InProcess':
      // Straddles today: started a fraction of its duration ago.
      start = TODAY_REF - dur * (0.35 + r2 * 0.4)
      break
    case 'Released':
      // Kicking off around now, mostly ahead.
      start = TODAY_REF - dur * 0.12 + r2 * 0.05
      break
    case 'Created':
    default:
      // Planned ahead of today.
      start = TODAY_REF + 0.03 + r2 * 0.34
      break
  }

  const clampedStart = Math.max(0, Math.min(0.97, start))
  const end = Math.max(clampedStart + 0.03, Math.min(1, clampedStart + dur))
  return { orderNo: order.orderNo, description: order.description, status: order.status, start: clampedStart, end }
}

/**
 * Build the Gantt model for a set of orders, ordered for display: in-flight work
 * first (InProcess, Released), then Created, then Completed — and within each
 * status, earliest start first so the strip reads left-to-right top-to-bottom.
 */
export function buildGantt(orders: ProductionOrder[], limit = 14): GanttBar[] {
  const statusRank: Record<ProdOrderStatus, number> = {
    InProcess: 0,
    Released: 1,
    Created: 2,
    Completed: 3,
  }
  return orders
    .map(ganttBarFor)
    .sort((a, b) => {
      if (statusRank[a.status] !== statusRank[b.status]) {
        return statusRank[a.status] - statusRank[b.status]
      }
      if (a.start !== b.start) return a.start - b.start
      return a.orderNo.localeCompare(b.orderNo)
    })
    .slice(0, limit)
}
