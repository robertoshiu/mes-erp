import { describe, it, expect } from 'vitest'
import { generateMasterData } from '../master'
import { generateErpData } from './index'

const md = generateMasterData()

describe('generateErpData — determinism', () => {
  it('produces deep-equal output across two runs with the same master data', () => {
    const a = generateErpData(md)
    const b = generateErpData(generateMasterData())
    expect(a).toEqual(b)
  })

  it('serializes identically (no NaN / non-deterministic values)', () => {
    const a = generateErpData(md)
    const b = generateErpData(md)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('generateErpData — shape & volume', () => {
  const erp = generateErpData(md)

  it('produces 120-160 materials with all three types present', () => {
    expect(erp.materials.length).toBeGreaterThanOrEqual(120)
    expect(erp.materials.length).toBeLessThanOrEqual(160)
    const types = new Set(erp.materials.map(m => m.type))
    expect(types.has('FERT')).toBe(true)
    expect(types.has('ROH')).toBe(true)
    expect(types.has('HALB')).toBe(true)
  })

  it('produces sales, purchase and production orders in the expected ranges', () => {
    expect(erp.salesOrders.length).toBeGreaterThanOrEqual(40)
    expect(erp.salesOrders.length).toBeLessThanOrEqual(60)
    expect(erp.purchaseOrders.length).toBeGreaterThanOrEqual(30)
    expect(erp.purchaseOrders.length).toBeLessThanOrEqual(40)
    expect(erp.productionOrders.length).toBeGreaterThanOrEqual(30)
    expect(erp.productionOrders.length).toBeLessThanOrEqual(40)
  })

  it('has one FERT material per MES product', () => {
    const ferts = erp.materials.filter(m => m.type === 'FERT')
    expect(ferts.length).toBe(md.products.length)
    for (const fert of ferts) {
      expect(fert.productCode).toBeTruthy()
    }
  })

  it('uses deterministic YYYY-MM-DD date strings on orders', () => {
    const re = /^\d{4}-\d{2}-\d{2}$/
    for (const so of erp.salesOrders) {
      expect(so.orderDate).toMatch(re)
      expect(so.requestedDate).toMatch(re)
    }
    for (const po of erp.purchaseOrders) {
      expect(po.orderDate).toMatch(re)
      expect(po.deliveryDate).toMatch(re)
    }
  })
})

describe('generateErpData — referential integrity', () => {
  const erp = generateErpData(md)
  const materialNos = new Set(erp.materials.map(m => m.materialNo))
  const costCenterIds = new Set(erp.costCenters.map(c => c.costCenterId))
  const bpNos = new Set(erp.businessPartners.map(b => b.bpNo))
  const routeIds = new Set(md.routes.map(r => r.routeId))
  const salesOrderNos = new Set(erp.salesOrders.map(s => s.orderNo))

  it('every BOM header + component resolves to a real material', () => {
    for (const bom of erp.boms) {
      expect(materialNos.has(bom.headerMaterialNo)).toBe(true)
      expect(bom.components.length).toBeGreaterThanOrEqual(3)
      expect(bom.components.length).toBeLessThanOrEqual(6)
      for (const c of bom.components) {
        expect(materialNos.has(c.materialNo)).toBe(true)
      }
    }
  })

  it('every sales order line references a real FERT material and a real customer BP', () => {
    const fertNos = new Set(
      erp.materials.filter(m => m.type === 'FERT').map(m => m.materialNo),
    )
    for (const so of erp.salesOrders) {
      expect(bpNos.has(so.bpNo)).toBe(true)
      expect(so.lines.length).toBeGreaterThanOrEqual(1)
      for (const line of so.lines) {
        expect(fertNos.has(line.materialNo)).toBe(true)
      }
    }
  })

  it('every purchase order line references a real ROH material and a real vendor BP', () => {
    const rohNos = new Set(
      erp.materials.filter(m => m.type === 'ROH').map(m => m.materialNo),
    )
    for (const po of erp.purchaseOrders) {
      expect(bpNos.has(po.bpNo)).toBe(true)
      for (const line of po.lines) {
        expect(rohNos.has(line.materialNo)).toBe(true)
      }
    }
  })

  it('every production order resolves material + route, and any salesOrderNo is real', () => {
    for (const po of erp.productionOrders) {
      expect(materialNos.has(po.materialNo)).toBe(true)
      expect(routeIds.has(po.routeId)).toBe(true)
      expect(po.lotId).toBeNull()
      if (po.salesOrderNo !== null) {
        expect(salesOrderNos.has(po.salesOrderNo)).toBe(true)
      }
    }
  })

  it('every work center maps to a real cost center', () => {
    expect(erp.workCenters.length).toBeGreaterThan(0)
    for (const wc of erp.workCenters) {
      expect(costCenterIds.has(wc.costCenterId)).toBe(true)
    }
  })

  it('every inventory row references a real material and a valid storage location', () => {
    const fab01 = erp.plants.find(p => p.plantId === 'FAB-01')!
    for (const row of erp.inventory) {
      expect(materialNos.has(row.materialNo)).toBe(true)
      expect(fab01.storageLocations).toContain(row.storageLoc)
      expect(row.available).toBe(Math.max(0, row.onHand - row.committed))
      expect(row.available).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('generateErpData — inventory shortages', () => {
  it('has at least one short material for the MRP board', () => {
    const erp = generateErpData(md)
    const SHORTAGE_THRESHOLD = 5
    const short = erp.inventory.filter(r => r.available < SHORTAGE_THRESHOLD)
    expect(short.length).toBeGreaterThan(0)
  })
})
