import { seededRng, pick } from '../prng'
import type { EventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { MasterData } from '../master'
import type { ErpData } from '../erp/types'
import type { ScmData, Lane, Shipment } from './types'
import { useShipments } from '../../lib/useShipments'

// THE SCM SPINE. The shipment-driver owns shipment lifecycle via the useShipments
// zustand store (mirrors the ERP bridge + useBridgedLots). It turns ERP purchase
// orders into inbound shipments that cross the network and post a PO-keyed goods
// receipt on arrival, and finished MES lots into outbound shipments that deliver
// to a customer. DISCRETE state only (plan ARCH-1): a 200ms tick reads
// clock.loopT() and fires only STATUS TRANSITIONS (created → in-transit →
// arrived/delivered) — never per-tick position; the Control Tower computes each
// dot's position from shipmentPosition(loopT, departureT, transitSeconds). In-flight
// shipments are cleared + re-seeded on the loop boundary so they never orphan at
// the 180s wrap (ARCH-2).

// Real transit-days are scaled into loop seconds so shipments cross within a loop.
const TRANSIT_SECONDS_PER_DAY = 4
// How many "already in-transit" shipments to seed on start + every boundary (ARCH-2).
const SEED_COUNT = 6

let driverSeq = 0

interface InFlight {
  shipment: Shipment
}

export interface ShipmentDriver {
  start(): void
  stop(): void
  /** Load N deterministic already-in-transit shipments (ARCH-2). Exposed for tests. */
  seedInitial(loopIndex: number): void
}

export function createShipmentDriver(
  clock: Clock,
  eventBus: EventBus,
  _masterData: MasterData,
  erpData: ErpData,
  scmData: ScmData,
): ShipmentDriver {
  const { networkNodes, lanes } = scmData

  const fabNode = networkNodes.find(n => n.kind === 'fab') ?? null
  const supplierNodes = networkNodes.filter(n => n.kind === 'supplier')
  const dcNodes = networkNodes.filter(n => n.kind === 'dc')
  const customerNodes = networkNodes.filter(n => n.kind === 'customer')

  // Lane lookup keyed "from->to" so a leg between two nodes resolves in O(1).
  const laneByEnds = new Map<string, Lane>()
  for (const l of lanes) laneByEnds.set(`${l.from}->${l.to}`, l)
  const laneBetween = (from: string, to: string): Lane | undefined =>
    laneByEnds.get(`${from}->${to}`)

  // prodOrderNo → salesOrderNo, so an outbound lot can close its sales order.
  const soByProdOrder = new Map(
    erpData.productionOrders.map(o => [o.orderNo, o.salesOrderNo]),
  )

  const transitSecondsOf = (lane: Lane): number =>
    Math.max(2, Math.round(lane.transitDays * TRANSIT_SECONDS_PER_DAY))

  const inFlight = new Map<string, InFlight>()

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let subPo: { unsubscribe: () => void } | null = null
  let subLot: { unsubscribe: () => void } | null = null
  let unsubBoundary: (() => void) | null = null

  // ---- Inbound: erp.po.created → supplier → FAB-01 shipment ----
  function onPoCreated(e: Extract<import('../../lib/erpEvents').ErpEvent, { topic: 'erp.po.created' }>) {
    // GUARD (mirror bridge.ts): no fab / supplier / inbound lane → skip, no throw.
    if (!fabNode || supplierNodes.length === 0) return
    const supplier = supplierNodes[driverSeq % supplierNodes.length]
    const lane = laneBetween(supplier.id, fabNode.id)
    if (!lane) return

    const t = clock.loopT()
    const shipment: Shipment = {
      shipmentNo: `SHP-${500000 + driverSeq++}`,
      direction: 'inbound',
      fromNode: supplier.id,
      toNode: fabNode.id,
      laneId: lane.id,
      refDoc: { poNo: e.poNo },
      materialNo: e.materialNo,
      qty: e.qty,
      status: 'created',
      departureT: t,
      transitSeconds: transitSecondsOf(lane),
    }
    useShipments.getState().addShipment(shipment)
    inFlight.set(shipment.shipmentNo, { shipment })
    eventBus.publish({
      topic: 'scm.shipment.created', t,
      shipmentNo: shipment.shipmentNo, direction: 'inbound',
      fromNode: shipment.fromNode, toNode: shipment.toNode, laneId: shipment.laneId,
      materialNo: shipment.materialNo, qty: shipment.qty,
      poNo: e.poNo, salesOrderNo: null,
    })
  }

  // ---- Outbound: lot.complete → FAB-01 → DC → customer shipment ----
  function onLotComplete(e: Extract<import('../../lib/events').MesEvent, { topic: 'lot.complete' }>) {
    // GUARD: no fab / customer / outbound lane → skip outbound, no throw.
    if (!fabNode || customerNodes.length === 0) return
    const customer = customerNodes[driverSeq % customerNodes.length]
    // Prefer a fab → DC → customer routing; fall back to a direct fab → customer lane.
    const dc = dcNodes.length ? dcNodes[driverSeq % dcNodes.length] : null
    const lane =
      (dc && laneBetween(fabNode.id, dc.id)) ?? laneBetween(fabNode.id, customer.id)
    if (!lane) return

    const t = clock.loopT()
    const salesOrderNo = soByProdOrder.get(e.prodOrderNo) ?? null
    const shipment: Shipment = {
      shipmentNo: `SHP-${500000 + driverSeq++}`,
      direction: 'outbound',
      fromNode: fabNode.id,
      toNode: customer.id,
      laneId: lane.id,
      refDoc: salesOrderNo ? { salesOrderNo } : {},
      materialNo: e.materialNo,
      qty: e.qty,
      status: 'created',
      departureT: t,
      transitSeconds: transitSecondsOf(lane),
    }
    useShipments.getState().addShipment(shipment)
    inFlight.set(shipment.shipmentNo, { shipment })
    eventBus.publish({
      topic: 'scm.shipment.created', t,
      shipmentNo: shipment.shipmentNo, direction: 'outbound',
      fromNode: shipment.fromNode, toNode: shipment.toNode, laneId: shipment.laneId,
      materialNo: shipment.materialNo, qty: shipment.qty,
      poNo: null, salesOrderNo,
    })
  }

  function depart(f: InFlight, t: number) {
    const { shipment } = f
    shipment.status = 'in-transit'
    useShipments.getState().transition(shipment.shipmentNo, 'in-transit')
    eventBus.publish({
      topic: 'scm.shipment.departed', t,
      shipmentNo: shipment.shipmentNo,
      fromNode: shipment.fromNode, toNode: shipment.toNode, laneId: shipment.laneId,
      materialNo: shipment.materialNo, qty: shipment.qty,
    })
  }

  function arrive(f: InFlight, t: number) {
    const { shipment } = f
    inFlight.delete(shipment.shipmentNo)
    if (shipment.direction === 'inbound') {
      shipment.status = 'arrived'
      useShipments.getState().transition(shipment.shipmentNo, 'arrived')
      const poNo = shipment.refDoc.poNo ?? null
      eventBus.publish({
        topic: 'scm.shipment.arrived', t,
        shipmentNo: shipment.shipmentNo, toNode: shipment.toNode,
        materialNo: shipment.materialNo, qty: shipment.qty, poNo,
      })
      // PO-keyed inbound goods receipt — SCM owns inbound receipt timing (ARCH-3).
      eventBus.publish({
        topic: 'erp.goods.movement', t,
        movementType: 'GR', storageLoc: 'RAW',
        materialNo: shipment.materialNo, qty: shipment.qty,
      })
    } else {
      shipment.status = 'delivered'
      useShipments.getState().transition(shipment.shipmentNo, 'delivered')
      const salesOrderNo = shipment.refDoc.salesOrderNo ?? null
      eventBus.publish({
        topic: 'scm.shipment.delivered', t,
        shipmentNo: shipment.shipmentNo, toNode: shipment.toNode,
        materialNo: shipment.materialNo, qty: shipment.qty, salesOrderNo,
      })
      // ATP reconciliation on delivery.
      eventBus.publish({
        topic: 'scm.atp.promised', t,
        salesOrderNo: salesOrderNo ?? shipment.shipmentNo,
        materialNo: shipment.materialNo,
        promisedDate: deliveryDate(t),
        available: shipment.qty,
      })
    }
  }

  // Deterministic promised-date string (loop-relative; no wall-clock).
  function deliveryDate(t: number): string {
    const day = Math.max(1, Math.round(t / TRANSIT_SECONDS_PER_DAY))
    return `D+${day}`
  }

  function tick() {
    const t = clock.loopT()
    for (const f of [...inFlight.values()]) {
      const { shipment } = f
      // If the clock wrapped (t < departureT) the boundary handler will reset; skip.
      if (t < shipment.departureT) continue
      const frac = (t - shipment.departureT) / shipment.transitSeconds
      if (shipment.status === 'created') {
        depart(f, t)
        // After departure, also check whether it has already arrived (seeded mid-lane).
        if (frac >= 1) arrive(f, t)
      } else if (shipment.status === 'in-transit' && frac >= 1) {
        arrive(f, t)
      }
    }
  }

  // ---- ARCH-2: seed N already-in-transit shipments (start + every boundary) ----
  function seedInitial(loopIndex: number) {
    if (!fabNode) return
    const rng = seededRng(loopIndex, 2000)
    const boundaryT = clock.loopT()
    for (let i = 0; i < SEED_COUNT; i++) {
      // Alternate inbound / outbound so the map populates both legs on first paint.
      const inbound = i % 2 === 0
      const seeded = inbound
        ? seedInbound(rng, boundaryT)
        : seedOutbound(rng, boundaryT)
      if (!seeded) continue
      useShipments.getState().addShipment(seeded)
      inFlight.set(seeded.shipmentNo, { shipment: seeded })
    }
  }

  function seedInbound(rng: () => number, boundaryT: number): Shipment | null {
    if (!fabNode || supplierNodes.length === 0) return null
    const supplier = pick(supplierNodes, rng)
    const lane = laneBetween(supplier.id, fabNode.id)
    if (!lane) return null
    const transitSeconds = transitSecondsOf(lane)
    return {
      shipmentNo: `SHP-${500000 + driverSeq++}`,
      direction: 'inbound',
      fromNode: supplier.id,
      toNode: fabNode.id,
      laneId: lane.id,
      refDoc: { poNo: `PO-${100000 + Math.floor(rng() * 9999)}` },
      materialNo: `MAT-${Math.floor(rng() * 100)}`,
      qty: (1 + Math.floor(rng() * 20)) * 10,
      status: 'in-transit',
      // Spread departureT so seeded dots scatter mid-lane on first paint (design Fix 9).
      departureT: boundaryT - rng() * transitSeconds,
      transitSeconds,
    }
  }

  function seedOutbound(rng: () => number, boundaryT: number): Shipment | null {
    if (!fabNode || customerNodes.length === 0) return null
    const customer = pick(customerNodes, rng)
    const dc = dcNodes.length ? pick(dcNodes, rng) : null
    const lane =
      (dc && laneBetween(fabNode.id, dc.id)) ?? laneBetween(fabNode.id, customer.id)
    if (!lane) return null
    const transitSeconds = transitSecondsOf(lane)
    return {
      shipmentNo: `SHP-${500000 + driverSeq++}`,
      direction: 'outbound',
      fromNode: fabNode.id,
      toNode: customer.id,
      laneId: lane.id,
      refDoc: { salesOrderNo: `SO-${200000 + Math.floor(rng() * 9999)}` },
      materialNo: `MAT-${Math.floor(rng() * 100)}`,
      qty: (1 + Math.floor(rng() * 20)) * 10,
      status: 'in-transit',
      departureT: boundaryT - rng() * transitSeconds,
      transitSeconds,
    }
  }

  function onBoundary(loopIndex: number) {
    // Critical: clear in-flight + the store so shipments don't orphan at the wrap,
    // THEN re-seed so the hero map never blanks (ARCH-2).
    inFlight.clear()
    useShipments.getState().reset()
    seedInitial(loopIndex)
  }

  function start() {
    // Subscribe BEFORE the ERP engine emits (caller guarantees ordering) so the
    // first erp.po.created / lot.complete aren't dropped.
    subPo = eventBus.ofTopic('erp.po.created').subscribe(onPoCreated)
    subLot = eventBus.ofTopic('lot.complete').subscribe(onLotComplete)
    unsubBoundary = clock.onLoopBoundary(onBoundary)
    seedInitial(clock.loopIndex())
    tickInterval = setInterval(tick, 200)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (subPo) subPo.unsubscribe()
    if (subLot) subLot.unsubscribe()
    if (unsubBoundary) unsubBoundary()
  }

  return { start, stop, seedInitial }
}
