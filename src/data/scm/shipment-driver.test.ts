import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { MasterData } from '../master'
import type { ErpData } from '../erp/types'
import type { AppEvent } from '../../lib/events'
import { useShipments } from '../../lib/useShipments'
import { createShipmentDriver } from './shipment-driver'
import type { ScmData, NetworkNode, Lane } from './types'

// ---- Controllable fake clock — loopT/loopIndex are set by the test, never wall-clock.
function makeFakeClock() {
  let t = 0
  let idx = 0
  let boundaryCb: ((i: number) => void) | null = null
  const clock: Clock = {
    now: () => idx * 180 + t,
    loopT: () => t,
    loopIndex: () => idx,
    start: () => {},
    onLoopBoundary: (cb) => {
      boundaryCb = cb
      return () => { boundaryCb = null }
    },
    destroy: () => {},
  }
  return {
    clock,
    setT: (v: number) => { t = v },
    setIdx: (v: number) => { idx = v },
    fireBoundary: (newIdx: number) => { idx = newIdx; boundaryCb?.(newIdx) },
  }
}

const NODES: NetworkNode[] = [
  { id: 'SUP-1', kind: 'supplier', name: 'Supplier One', region: 'APAC', x: 100, y: 100, labelSide: 'left' },
  { id: 'FAB-01', kind: 'fab', name: 'FAB-01', region: 'TW', x: 500, y: 280, labelSide: 'top' },
  { id: 'DC-1', kind: 'dc', name: 'DC West', region: 'US', x: 700, y: 200, labelSide: 'right' },
  { id: 'CUST-1', kind: 'customer', name: 'Customer One', region: 'EU', x: 900, y: 300, labelSide: 'right' },
]

const LANES: Lane[] = [
  { id: 'LANE-IN', from: 'SUP-1', to: 'FAB-01', mode: 'sea', transitDays: 3 },
  { id: 'LANE-OUT-DC', from: 'FAB-01', to: 'DC-1', mode: 'air', transitDays: 2 },
  { id: 'LANE-OUT-CUST', from: 'FAB-01', to: 'CUST-1', mode: 'truck', transitDays: 2 },
]

function makeScmData(over: Partial<ScmData> = {}): ScmData {
  return {
    networkNodes: NODES,
    lanes: LANES,
    forecasts: [{ materialNo: 'MAT-1', buckets: [100, 110], actuals: [95, 0] }],
    shipments: [],
    scorecards: [{ bpNo: 'BP-1', name: 'Supplier One', onTimePct: 95, qualityPct: 98, avgLeadDays: 12, openAsns: 2 }],
    atpPromises: [],
    ...over,
  }
}

const ERP: ErpData = {
  materials: [], businessPartners: [], boms: [], workCenters: [], costCenters: [],
  glAccounts: [], plants: [], salesOrders: [], purchaseOrders: [], inventory: [],
  productionOrders: [
    { orderNo: 'PRO-1', materialNo: 'MAT-1', description: 'x', routeId: 'R1', targetQty: 100, status: 'Released', salesOrderNo: 'SO-9001', lotId: null },
  ],
}

const MASTER = {} as MasterData

function poCreated(t: number, poNo = 'PO-100001'): Extract<AppEvent, { topic: 'erp.po.created' }> {
  return { topic: 'erp.po.created', t, poNo, bpNo: 'BP-1', vendorName: 'Supplier One', materialNo: 'MAT-RAW-1', qty: 120 }
}
function lotComplete(t: number, prodOrderNo = 'PRO-1'): Extract<AppEvent, { topic: 'lot.complete' }> {
  return { topic: 'lot.complete', t, lotId: 'LOT-1', prodOrderNo, materialNo: 'MAT-1', productCode: 'DEV-A', qty: 75 }
}

beforeEach(() => {
  useShipments.getState().reset()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('shipment-driver — inbound', () => {
  it('erp.po.created → inbound shipment in store; arrival emits scm.shipment.arrived + PO-keyed GR', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    const events: AppEvent[] = []
    bus.all$().subscribe(e => events.push(e))

    const driver = createShipmentDriver(clock, bus, MASTER, ERP, makeScmData())
    setT(0)
    driver.start()
    // Seeding ran in start(); ignore those for the inbound assertion.
    useShipments.getState().reset()

    bus.publish(poCreated(0))
    const created = useShipments.getState().shipments.find(s => s.refDoc.poNo === 'PO-100001')
    expect(created).toBeTruthy()
    expect(created!.direction).toBe('inbound')
    expect(created!.fromNode).toBe('SUP-1')
    expect(created!.toNode).toBe('FAB-01')

    // Advance the clock past transit, then run a tick — departs then arrives.
    setT(created!.departureT + created!.transitSeconds + 1)
    vi.advanceTimersByTime(200)

    const stored = useShipments.getState().shipments.find(s => s.shipmentNo === created!.shipmentNo)!
    expect(stored.status).toBe('arrived')

    const arrived = events.find(
      e => e.topic === 'scm.shipment.arrived' && e.shipmentNo === created!.shipmentNo,
    )
    expect(arrived).toBeTruthy()
    expect((arrived as Extract<AppEvent, { topic: 'scm.shipment.arrived' }>).poNo).toBe('PO-100001')

    // PO-keyed GR for THIS shipment's qty (the seeded shipments use different qtys).
    const gr = events.find(
      e => e.topic === 'erp.goods.movement' && e.movementType === 'GR' && e.storageLoc === 'RAW' && e.qty === 120,
    )
    expect(gr).toBeTruthy()

    driver.stop()
  })
})

describe('shipment-driver — outbound', () => {
  it('lot.complete → outbound shipment → scm.shipment.delivered (closing its sales order)', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    const events: AppEvent[] = []
    bus.all$().subscribe(e => events.push(e))

    const driver = createShipmentDriver(clock, bus, MASTER, ERP, makeScmData())
    setT(0)
    driver.start()
    useShipments.getState().reset()

    bus.publish(lotComplete(0))
    const created = useShipments.getState().shipments.find(s => s.direction === 'outbound')
    expect(created).toBeTruthy()
    expect(created!.fromNode).toBe('FAB-01')
    expect(created!.refDoc.salesOrderNo).toBe('SO-9001')

    setT(created!.departureT + created!.transitSeconds + 1)
    vi.advanceTimersByTime(200)

    const stored = useShipments.getState().shipments.find(s => s.shipmentNo === created!.shipmentNo)!
    expect(stored.status).toBe('delivered')

    const delivered = events.find(
      e => e.topic === 'scm.shipment.delivered' && e.shipmentNo === created!.shipmentNo,
    )
    expect(delivered).toBeTruthy()
    expect((delivered as Extract<AppEvent, { topic: 'scm.shipment.delivered' }>).salesOrderNo).toBe('SO-9001')
    expect(events.some(e => e.topic === 'scm.atp.promised')).toBe(true)

    driver.stop()
  })
})

describe('shipment-driver — GUARD (no lane/node)', () => {
  it('no supplier node / inbound lane → no inbound shipment, no throw', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    // ScmData with fab + customer but NO supplier and NO inbound lane.
    const scm = makeScmData({
      networkNodes: NODES.filter(n => n.kind !== 'supplier'),
      lanes: LANES.filter(l => l.id !== 'LANE-IN'),
    })
    const driver = createShipmentDriver(clock, bus, MASTER, ERP, scm)
    setT(0)
    driver.start()
    useShipments.getState().reset()

    expect(() => bus.publish(poCreated(0))).not.toThrow()
    expect(useShipments.getState().shipments.length).toBe(0)
    driver.stop()
  })

  it('no customer node / outbound lane → no outbound shipment, no throw', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    const scm = makeScmData({
      networkNodes: NODES.filter(n => n.kind !== 'customer'),
      lanes: LANES.filter(l => l.from !== 'FAB-01'),
    })
    const driver = createShipmentDriver(clock, bus, MASTER, ERP, scm)
    setT(0)
    driver.start()
    useShipments.getState().reset()

    expect(() => bus.publish(lotComplete(0))).not.toThrow()
    expect(useShipments.getState().shipments.length).toBe(0)
    driver.stop()
  })
})

describe('shipment-driver — seedInitial (ARCH-2)', () => {
  it('seeds in-transit shipments on start, spread mid-lane (position 0..1)', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    const driver = createShipmentDriver(clock, bus, MASTER, ERP, makeScmData())
    setT(0)
    driver.start()

    const seeded = useShipments.getState().shipments
    expect(seeded.length).toBeGreaterThan(0)
    for (const s of seeded) {
      expect(s.status).toBe('in-transit')
      // Spread departureT = boundaryT - rng()*transit → departureT in (boundaryT-transit, boundaryT].
      expect(s.departureT).toBeLessThanOrEqual(0)
      expect(s.departureT).toBeGreaterThan(-s.transitSeconds)
    }
    driver.stop()
  })

  it('is deterministic for a given loopIndex', () => {
    const a = makeFakeClock(); const b = makeFakeClock()
    const busA = createEventBus(); const busB = createEventBus()
    const dA = createShipmentDriver(a.clock, busA, MASTER, ERP, makeScmData())
    a.setIdx(3); a.setT(0); dA.start()
    const snapA = useShipments.getState().shipments.map(s => ({ ...s, shipmentNo: '' }))
    dA.stop()
    useShipments.getState().reset()
    const dB = createShipmentDriver(b.clock, busB, MASTER, ERP, makeScmData())
    b.setIdx(3); b.setT(0); dB.start()
    const snapB = useShipments.getState().shipments.map(s => ({ ...s, shipmentNo: '' }))
    dB.stop()
    expect(snapA).toEqual(snapB)
  })

  it('onBoundary resets the store then re-seeds (the wrap edge never blanks)', () => {
    const { clock, setT, fireBoundary } = makeFakeClock()
    const bus = createEventBus()
    const driver = createShipmentDriver(clock, bus, MASTER, ERP, makeScmData())
    setT(0)
    driver.start()
    // Dirty the store with a real inbound shipment.
    bus.publish(poCreated(0))
    const before = useShipments.getState().shipments.length
    expect(before).toBeGreaterThan(0)

    // Cross the loop boundary: store resets, then re-seeds.
    setT(0)
    fireBoundary(1)
    const after = useShipments.getState().shipments
    expect(after.length).toBeGreaterThan(0)
    // The old PO shipment is gone (store was reset before re-seed).
    expect(after.some(s => s.refDoc.poNo === 'PO-100001')).toBe(false)
    expect(after.every(s => s.status === 'in-transit')).toBe(true)
    driver.stop()
  })
})

describe('shipment-driver — clock wrap skip', () => {
  it('a tick where loopT < departureT (wrapped) does not transition', () => {
    const { clock, setT } = makeFakeClock()
    const bus = createEventBus()
    const driver = createShipmentDriver(clock, bus, MASTER, ERP, makeScmData())
    setT(100)
    driver.start()
    useShipments.getState().reset()

    bus.publish(poCreated(100))
    const created = useShipments.getState().shipments.find(s => s.refDoc.poNo === 'PO-100001')!
    expect(created.status).toBe('created')

    // Simulate wrap: loopT jumps back below departureT.
    setT(2)
    vi.advanceTimersByTime(200)
    const stored = useShipments.getState().shipments.find(s => s.shipmentNo === created.shipmentNo)!
    expect(stored.status).toBe('created')
    driver.stop()
  })
})
