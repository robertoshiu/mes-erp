import { seededRng, pick } from '../prng'
import type { EventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { ErpEvent } from '../../lib/erpEvents'
import type { ErpData, ProductionOrder } from './types'

// ERP simulation engine — mirrors the MES timeline-engine, on the SAME clock but
// with a DISTINCT seed namespace (1000) so its event stream never correlates with
// the MES one. Emits ambient ERP activity (~1/s), periodic production-order
// releases that drive the bridge, and a few scripted spine beats per loop.

const AMBIENT_PER_SEC = 1
const RELEASE_EVERY_S = 15 // release one production order onto the floor every ~15s

export interface ErpTimelineEngine {
  preRoll(): void
  start(): void
  stop(): void
}

export function createErpTimelineEngine(
  clock: Clock,
  eventBus: EventBus,
  erpData: ErpData,
): ErpTimelineEngine {
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let unsubBoundary: (() => void) | null = null
  let rng: () => number = seededRng(0, 1000)

  const { materials, businessPartners, productionOrders, glAccounts, plants } = erpData
  const ferts = materials.filter(m => m.type === 'FERT')
  const raws = materials.filter(m => m.type === 'ROH')
  const customers = businessPartners.filter(b => b.role === 'customer' || b.role === 'both')
  const vendors = businessPartners.filter(b => b.role === 'vendor' || b.role === 'both')
  const codeOf = new Map(materials.map(m => [m.materialNo, m.productCode ?? m.materialNo]))
  const storageLocs = plants[0]?.storageLocations ?? ['RAW', 'WIP', 'FG']
  // Orders eligible to be released onto the floor (cycled through over the loop).
  const releasable: ProductionOrder[] =
    productionOrders.filter(o => o.status === 'Created' || o.status === 'Released')
  const releaseable = releasable.length > 0 ? releasable : productionOrders

  let seq = 0
  let releaseCursor = 0
  let releaseAccumulator = 0
  let ambientAccumulator = 0
  // Spine beats fired this loop (reset on boundary).
  let didRush = false
  let didMrp = false
  let didClose = false

  function releaseOrder(t: number): ErpEvent {
    const o = releaseable[releaseCursor % releaseable.length]
    releaseCursor++
    return {
      topic: 'erp.prodorder.released', t,
      orderNo: o.orderNo,
      materialNo: o.materialNo,
      productCode: codeOf.get(o.materialNo) ?? o.materialNo,
      routeId: o.routeId,
      qty: o.targetQty,
      salesOrderNo: o.salesOrderNo,
    }
  }

  function ambient(t: number): ErpEvent {
    const roll = rng()
    if (roll < 0.3 && ferts.length && customers.length) {
      const mat = pick(ferts, rng)
      const cust = pick(customers, rng)
      return {
        topic: 'erp.order.created', t,
        orderNo: `SO-${200000 + seq++}`,
        bpNo: cust.bpNo, customerName: cust.name,
        materialNo: mat.materialNo, qty: (1 + Math.floor(rng() * 6)) * 25,
      }
    } else if (roll < 0.5 && raws.length && vendors.length) {
      const mat = pick(raws, rng)
      const ven = pick(vendors, rng)
      return {
        topic: 'erp.po.created', t,
        poNo: `PO-${100000 + seq++}`,
        bpNo: ven.bpNo, vendorName: ven.name,
        materialNo: mat.materialNo, qty: (1 + Math.floor(rng() * 20)) * 10,
      }
    } else if (roll < 0.6) {
      // ARCH-3: ambient goods-movement narrowed (was <0.72) so SCM's PO-keyed
      // inbound GR carries the Cockpit GR-lane — reduced, not zeroed.
      const mat = pick(materials, rng)
      const gr = rng() > 0.5
      return {
        topic: 'erp.goods.movement', t,
        movementType: gr ? 'GR' : 'GI',
        materialNo: mat.materialNo, qty: (1 + Math.floor(rng() * 12)) * 5,
        storageLoc: pick(storageLocs, rng),
      }
    } else if (roll < 0.85 && raws.length && vendors.length) {
      const mat = pick(raws, rng)
      return {
        topic: 'erp.po.received', t,
        poNo: `PO-${100000 + Math.floor(rng() * 9999)}`,
        materialNo: mat.materialNo, qty: (1 + Math.floor(rng() * 20)) * 10,
      }
    } else {
      const acct = glAccounts.length ? pick(glAccounts, rng) : { accountNo: '400000', name: 'Revenue', type: 'revenue' as const }
      const amount = Math.round((rng() - 0.3) * 50000)
      return {
        topic: 'erp.gl.posting', t,
        accountNo: acct.accountNo, accountName: acct.name,
        amount, ref: `DOC-${500000 + seq++}`,
      }
    }
  }

  function fireSpine(t: number) {
    // Rush order ~25s in, then immediately release it.
    if (!didRush && t >= 25 && customers.length && ferts.length) {
      didRush = true
      const cust = pick(customers, rng)
      const mat = pick(ferts, rng)
      eventBus.publish({
        topic: 'erp.order.created', t,
        orderNo: `SO-RUSH-${seq++}`, bpNo: cust.bpNo, customerName: cust.name,
        materialNo: mat.materialNo, qty: 75,
      })
      eventBus.publish(releaseOrder(t))
    }
    // MRP run ~45s in — surfaces the current shortage count.
    if (!didMrp && t >= 45) {
      didMrp = true
      const shortages = erpData.inventory.filter(r => r.available <= 0).length
      eventBus.publish({ topic: 'erp.mrp.run', t, shortages, plannedOrders: Math.max(1, Math.round(shortages * 0.6)) })
    }
    // Month-end close ~155s in — a few GL postings.
    if (!didClose && t >= 155 && glAccounts.length) {
      didClose = true
      for (let i = 0; i < 3; i++) {
        const acct = pick(glAccounts, rng)
        eventBus.publish({
          topic: 'erp.gl.posting', t,
          accountNo: acct.accountNo, accountName: acct.name,
          amount: Math.round((rng() - 0.2) * 120000), ref: `CLOSE-${seq++}`,
        })
      }
    }
  }

  function tick() {
    const t = clock.loopT()
    fireSpine(t)

    ambientAccumulator += 0.2 // tick is 200ms
    while (ambientAccumulator >= 1 / AMBIENT_PER_SEC) {
      ambientAccumulator -= 1 / AMBIENT_PER_SEC
      eventBus.publish(ambient(t))
    }

    releaseAccumulator += 0.2
    while (releaseAccumulator >= RELEASE_EVERY_S) {
      releaseAccumulator -= RELEASE_EVERY_S
      eventBus.publish(releaseOrder(t))
    }
  }

  function resetLoop(loopIndex: number) {
    rng = seededRng(loopIndex, 1000)
    seq = 0
    ambientAccumulator = 0
    releaseAccumulator = 0
    didRush = didMrp = didClose = false
  }

  function preRoll() {
    // Warm the feed so ERP screens aren't empty on first paint.
    rng = seededRng(clock.loopIndex(), 1000)
    const events: ErpEvent[] = []
    for (let t = -20; t < 0; t++) {
      if (rng() < 0.8) events.push(ambient(t))
    }
    eventBus.publishBatch(events)
  }

  function start() {
    resetLoop(clock.loopIndex())
    // Release the first order quickly so the bridge has something in flight.
    releaseAccumulator = RELEASE_EVERY_S - 3
    unsubBoundary = clock.onLoopBoundary(resetLoop)
    tickInterval = setInterval(tick, 200)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (unsubBoundary) unsubBoundary()
  }

  return { preRoll, start, stop }
}
