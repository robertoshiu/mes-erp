import { describe, it, expect } from 'vitest'
import { generateMasterData } from '../master'
import { generateErpData } from '../erp'
import type { ErpData } from '../erp/types'
import { generateScmData } from './index'

const md = generateMasterData()
const erp = generateErpData(md)

/** Clone the real ERP data and override slices for edge-case scenarios. */
function erpWith(overrides: Partial<ErpData>): ErpData {
  return { ...erp, ...overrides }
}

describe('generateScmData — determinism', () => {
  it('produces deep-equal output across two runs with the same input', () => {
    const a = generateScmData(md, erp)
    const b = generateScmData(generateMasterData(), generateErpData(generateMasterData()))
    expect(a).toEqual(b)
  })

  it('serializes identically (no NaN / non-deterministic values)', () => {
    const a = generateScmData(md, erp)
    const b = generateScmData(md, erp)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('generateScmData — shape & volume', () => {
  const scm = generateScmData(md, erp)

  it('produces non-empty nodes, lanes, forecasts, scorecards', () => {
    expect(scm.networkNodes.length).toBeGreaterThan(0)
    expect(scm.lanes.length).toBeGreaterThan(0)
    expect(scm.forecasts.length).toBeGreaterThan(0)
    expect(scm.scorecards.length).toBeGreaterThan(0)
    expect(scm.shipments.length).toBeGreaterThan(0)
    expect(scm.atpPromises.length).toBeGreaterThan(0)
  })

  it('honors the node budget: <=5 suppliers, exactly one FAB, 2-3 DCs, <=4 customers', () => {
    const byKind = (k: string) => scm.networkNodes.filter(n => n.kind === k)
    expect(byKind('supplier').length).toBeGreaterThan(0)
    expect(byKind('supplier').length).toBeLessThanOrEqual(5)
    expect(byKind('fab').length).toBe(1)
    expect(byKind('dc').length).toBeGreaterThanOrEqual(2)
    expect(byKind('dc').length).toBeLessThanOrEqual(3)
    expect(byKind('customer').length).toBeGreaterThan(0)
    expect(byKind('customer').length).toBeLessThanOrEqual(4)
  })

  it('places every node on the >=24px safe inset of the 1000x560 viewBox', () => {
    for (const n of scm.networkNodes) {
      expect(n.x).toBeGreaterThanOrEqual(24)
      expect(n.x).toBeLessThanOrEqual(1000 - 24)
      expect(n.y).toBeGreaterThanOrEqual(24)
      expect(n.y).toBeLessThanOrEqual(560 - 24)
      expect(['left', 'right', 'top', 'bottom']).toContain(n.labelSide)
    }
  })

  it('gives every node a unique id', () => {
    const ids = scm.networkNodes.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('wires every lane between two real nodes and into/out of FAB-01', () => {
    const ids = new Set(scm.networkNodes.map(n => n.id))
    const fab = scm.networkNodes.find(n => n.kind === 'fab')!
    for (const lane of scm.lanes) {
      expect(ids.has(lane.from)).toBe(true)
      expect(ids.has(lane.to)).toBe(true)
      expect(['air', 'sea', 'truck']).toContain(lane.mode)
      expect(lane.transitDays).toBeGreaterThan(0)
    }
    // Every supplier feeds FAB-01; FAB-01 feeds every DC.
    const suppliers = scm.networkNodes.filter(n => n.kind === 'supplier')
    for (const s of suppliers) {
      expect(scm.lanes.some(l => l.from === s.id && l.to === fab.id)).toBe(true)
    }
    const dcs = scm.networkNodes.filter(n => n.kind === 'dc')
    for (const d of dcs) {
      expect(scm.lanes.some(l => l.from === fab.id && l.to === d.id)).toBe(true)
    }
  })

  it('builds one forecast per FERT material with matching bucket/actual lengths', () => {
    const ferts = erp.materials.filter(m => m.type === 'FERT')
    expect(scm.forecasts.length).toBe(ferts.length)
    const fertNos = new Set(ferts.map(m => m.materialNo))
    for (const f of scm.forecasts) {
      expect(fertNos.has(f.materialNo)).toBe(true)
      expect(f.buckets.length).toBe(f.actuals.length)
      expect(f.buckets.length).toBeGreaterThan(0)
      for (const v of f.buckets) expect(Number.isFinite(v)).toBe(true)
      for (const v of f.actuals) expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('seeds in-flight shipments scattered mid-lane (negative departureT, real lanes)', () => {
    const laneIds = new Set(scm.lanes.map(l => l.id))
    for (const s of scm.shipments) {
      expect(laneIds.has(s.laneId)).toBe(true)
      expect(s.status).toBe('in-transit')
      expect(s.transitSeconds).toBeGreaterThan(0)
      // Spread back across the lane so position scatters 0..1 at loopT 0.
      expect(s.departureT).toBeLessThanOrEqual(0)
      expect(s.departureT).toBeGreaterThan(-s.transitSeconds)
      if (s.direction === 'inbound') expect(s.refDoc.poNo).toBeTruthy()
      else expect(s.refDoc.salesOrderNo).toBeTruthy()
    }
    // Both directions seeded for first paint.
    expect(scm.shipments.some(s => s.direction === 'inbound')).toBe(true)
    expect(scm.shipments.some(s => s.direction === 'outbound')).toBe(true)
  })

  it('builds scorecards from real vendor BPs (capped at 5)', () => {
    const vendorNos = new Set(
      erp.businessPartners.filter(b => b.role === 'vendor' || b.role === 'both').map(b => b.bpNo),
    )
    expect(scm.scorecards.length).toBeLessThanOrEqual(5)
    for (const sc of scm.scorecards) {
      expect(vendorNos.has(sc.bpNo)).toBe(true)
      expect(sc.onTimePct).toBeGreaterThanOrEqual(0)
      expect(sc.onTimePct).toBeLessThanOrEqual(100)
      expect(sc.qualityPct).toBeGreaterThanOrEqual(0)
      expect(sc.qualityPct).toBeLessThanOrEqual(100)
      expect(sc.avgLeadDays).toBeGreaterThan(0)
      expect(sc.openAsns).toBeGreaterThanOrEqual(0)
    }
  })

  it('builds ATP promises against real open/in-process sales orders', () => {
    const liveSoNos = new Set(
      erp.salesOrders.filter(s => s.status === 'open' || s.status === 'in-process').map(s => s.orderNo),
    )
    const re = /^\d{4}-\d{2}-\d{2}$/
    for (const p of scm.atpPromises) {
      expect(liveSoNos.has(p.salesOrderNo)).toBe(true)
      expect(p.promisedDate).toMatch(re)
      expect(p.available).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('generateScmData — degenerate-input edge cases', () => {
  it('zero vendors still yields FAB-01 + DCs (no suppliers, no scorecards, no inbound shipments)', () => {
    const noVendors = erpWith({
      businessPartners: erp.businessPartners.filter(b => b.role === 'customer'),
    })
    const scm = generateScmData(md, noVendors)
    expect(scm.networkNodes.some(n => n.kind === 'fab')).toBe(true)
    expect(scm.networkNodes.filter(n => n.kind === 'dc').length).toBeGreaterThanOrEqual(2)
    expect(scm.networkNodes.filter(n => n.kind === 'supplier').length).toBe(0)
    expect(scm.scorecards.length).toBe(0)
    expect(scm.shipments.every(s => s.direction !== 'inbound')).toBe(true)
  })

  it('zero customers still yields FAB-01 + DCs (no customer nodes, no outbound shipments, no ATP)', () => {
    const noCustomers = erpWith({
      businessPartners: erp.businessPartners.filter(b => b.role === 'vendor'),
      salesOrders: [],
    })
    const scm = generateScmData(md, noCustomers)
    expect(scm.networkNodes.some(n => n.kind === 'fab')).toBe(true)
    expect(scm.networkNodes.filter(n => n.kind === 'dc').length).toBeGreaterThanOrEqual(2)
    expect(scm.networkNodes.filter(n => n.kind === 'customer').length).toBe(0)
    expect(scm.atpPromises.length).toBe(0)
    expect(scm.shipments.every(s => s.direction !== 'outbound')).toBe(true)
  })

  it('zero FERT materials still builds the network but no forecasts', () => {
    const noFert = erpWith({
      materials: erp.materials.filter(m => m.type !== 'FERT'),
    })
    const scm = generateScmData(md, noFert)
    expect(scm.networkNodes.some(n => n.kind === 'fab')).toBe(true)
    expect(scm.networkNodes.filter(n => n.kind === 'dc').length).toBeGreaterThanOrEqual(2)
    expect(scm.forecasts.length).toBe(0)
  })

  it('fully empty ERP partners still yields FAB-01 + DCs + lanes among them', () => {
    const bare = erpWith({
      businessPartners: [],
      purchaseOrders: [],
      salesOrders: [],
    })
    const scm = generateScmData(md, bare)
    expect(scm.networkNodes.some(n => n.kind === 'fab')).toBe(true)
    expect(scm.networkNodes.filter(n => n.kind === 'dc').length).toBeGreaterThanOrEqual(2)
    // FAB -> DC lanes still wire up even with no suppliers/customers.
    expect(scm.lanes.length).toBeGreaterThan(0)
    expect(scm.shipments.length).toBe(0)
  })
})
