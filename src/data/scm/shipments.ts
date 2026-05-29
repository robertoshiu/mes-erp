import { mulberry32, pick } from '../prng'
import type { PurchaseOrder, SalesOrder } from '../erp/types'
import type { NetworkNode, Lane, Shipment } from './types'

const SHIPMENTS_SEED = 2040

// How many already-in-flight shipments to seed for first paint (ARCH-2). The
// runtime driver re-seeds N on start + every boundary with seededRng(loopIndex,
// 2000); this static set is the first-paint population baked into ScmData.
const SEED_INBOUND = 8
const SEED_OUTBOUND = 6

// Convert a lane's transitDays into loop seconds. A full sea leg should not
// exceed a fraction of the 180s loop, so days compress generously; air/truck
// land short. transitSeconds is what shipmentPosition() integrates against.
const SECONDS_PER_DAY = 2.4
const MIN_TRANSIT_SECONDS = 18

/**
 * Map a lane's transit days to loop seconds, floored so even the fastest lane
 * animates legibly across the map.
 */
export function transitSecondsForLane(lane: Lane): number {
  return Math.max(MIN_TRANSIT_SECONDS, Math.round(lane.transitDays * SECONDS_PER_DAY))
}

/**
 * Seed the initial in-flight shipment set for first paint (ARCH-2): inbound legs
 * from open purchase orders (a supplier node -> FAB-01) and outbound legs from
 * open/in-process sales orders (FAB-01 -> a DC -> a customer region). departureT
 * is spread back across each lane's transit window (departureT = -rng()*transit)
 * so the computed position scatters mid-lane (0..1) on first paint, never bunched
 * at the origin. GUARD: if no inbound lane to FAB-01 or no outbound DC/customer
 * lane resolves, the shipment is skipped (mirrors the driver guards). All
 * deterministic via a fixed seed.
 */
export function generateShipments(
  nodes: NetworkNode[],
  lanes: Lane[],
  purchaseOrders: PurchaseOrder[],
  salesOrders: SalesOrder[],
): Shipment[] {
  const rng = mulberry32(SHIPMENTS_SEED)
  const shipments: Shipment[] = []

  const fab = nodes.find(n => n.kind === 'fab')
  if (!fab) return shipments

  const suppliers = nodes.filter(n => n.kind === 'supplier')
  const dcs = nodes.filter(n => n.kind === 'dc')
  const customers = nodes.filter(n => n.kind === 'customer')

  const inboundLanes = lanes.filter(l => l.to === fab.id)
  const fabToDcLanes = lanes.filter(l => l.from === fab.id)
  const dcToCustomerLanes = lanes.filter(l =>
    dcs.some(d => d.id === l.from) && customers.some(c => c.id === l.to),
  )

  let counter = 0
  function nextNo(): string {
    counter++
    return `SH-${String(900000 + counter)}`
  }

  // --- Inbound: open POs -> a supplier lane into FAB-01 ---
  const openPos = purchaseOrders.filter(
    po => po.status === 'open' || po.status === 'confirmed' || po.status === 'late',
  )
  if (suppliers.length > 0 && inboundLanes.length > 0 && openPos.length > 0) {
    for (let i = 0; i < SEED_INBOUND; i++) {
      const po = openPos[i % openPos.length]
      const line = po.lines[0]
      if (!line) continue
      const lane = pick(inboundLanes, rng)
      const transitSeconds = transitSecondsForLane(lane)
      shipments.push({
        shipmentNo: nextNo(),
        direction: 'inbound',
        fromNode: lane.from,
        toNode: lane.to,
        laneId: lane.id,
        refDoc: { poNo: po.poNo },
        materialNo: line.materialNo,
        qty: line.qty,
        status: 'in-transit',
        // Spread back across the lane so dots scatter mid-lane on first paint.
        departureT: -rng() * transitSeconds,
        transitSeconds,
      })
    }
  }

  // --- Outbound: open/in-process SOs -> FAB-01 -> DC -> customer ---
  // We seed the FAB->DC leg (the visible first hop out of the fab) for first paint.
  const liveSos = salesOrders.filter(
    so => so.status === 'open' || so.status === 'in-process',
  )
  if (dcs.length > 0 && fabToDcLanes.length > 0 && dcToCustomerLanes.length > 0 && liveSos.length > 0) {
    for (let i = 0; i < SEED_OUTBOUND; i++) {
      const so = liveSos[i % liveSos.length]
      const line = so.lines[0]
      if (!line) continue
      const lane = pick(fabToDcLanes, rng)
      const transitSeconds = transitSecondsForLane(lane)
      shipments.push({
        shipmentNo: nextNo(),
        direction: 'outbound',
        fromNode: lane.from,
        toNode: lane.to,
        laneId: lane.id,
        refDoc: { salesOrderNo: so.orderNo },
        materialNo: line.materialNo,
        qty: line.qty,
        status: 'in-transit',
        departureT: -rng() * transitSeconds,
        transitSeconds,
      })
    }
  }

  return shipments
}
