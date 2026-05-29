/**
 * Live shipment position along its lane, in [0, 1] (plan ARCH-1).
 *
 * The useShipments store holds only DISCRETE state (departureT, transitSeconds,
 * status) — there is NO stored `progress`. The Control Tower computes each dot's
 * position per animation frame from this pure util, so the map never re-renders
 * the lane/node layer during transit.
 *
 *   position = clamp01((loopT - departureT) / transitSeconds)
 *
 * Before departure (loopT < departureT) -> 0; after arrival
 * (loopT > departureT + transitSeconds) -> 1. A non-positive transitSeconds is
 * treated as instantaneous (position 1 once departed, else 0) to avoid div-by-zero.
 */
export function shipmentPosition(
  loopT: number,
  departureT: number,
  transitSeconds: number,
): number {
  if (transitSeconds <= 0) return loopT >= departureT ? 1 : 0
  return clamp01((loopT - departureT) / transitSeconds)
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
