import { describe, it, expect } from 'vitest'
import {
  materialTypeCounts,
  abcClassify,
  abcCounts,
  whereUsedCounts,
  whereUsedParents,
  costTrend,
  roleSplit,
  regionCounts,
  compositeScore,
  topPartners,
  locationOccupancy,
  poPipeline,
  vendorOnTime,
  deliveryWindowDays,
  daysBetween,
} from './erpViz'
import type {
  Material,
  Bom,
  BusinessPartner,
  InventoryRow,
  PurchaseOrder,
} from '../../data/erp/types'

function mat(materialNo: string, type: Material['type'], standardCost: number): Material {
  return {
    materialNo,
    type,
    description: `${materialNo} desc`,
    baseUoM: 'EA',
    materialGroup: 'G1',
    plant: 'P100',
    valuationClass: '3000',
    standardCost,
    leadTimeDays: 5,
  }
}

function bp(bpNo: string, role: BusinessPartner['role'], country: string, creditLimit: number): BusinessPartner {
  return { bpNo, role, name: `${bpNo} Co`, country, paymentTerms: 'NET30', incoterms: 'FOB', creditLimit }
}

function inv(materialNo: string, storageLoc: string, onHand: number): InventoryRow {
  return { materialNo, description: 'd', plant: 'P100', storageLoc, onHand, committed: 0, available: onHand }
}

function po(poNo: string, vendorName: string, status: PurchaseOrder['status'], orderDate: string, deliveryDate: string): PurchaseOrder {
  return { poNo, bpNo: 'V1', vendorName, orderDate, deliveryDate, status, lines: [], netValue: 1000 }
}

describe('materialTypeCounts', () => {
  it('counts each type and keeps the fixed FERT/HALB/ROH shape', () => {
    const c = materialTypeCounts([mat('A', 'FERT', 10), mat('B', 'FERT', 5), mat('C', 'ROH', 2)])
    expect(c).toEqual({ FERT: 2, HALB: 0, ROH: 1 })
  })
})

describe('abcClassify', () => {
  it('classifies by cumulative cost: dominant items are A, tail is C', () => {
    const mats = [mat('HI', 'ROH', 1000), mat('MID', 'ROH', 100), mat('LO1', 'ROH', 5), mat('LO2', 'ROH', 5)]
    const map = abcClassify(mats)
    expect(map.get('HI')).toBe('A')
    expect(map.get('LO2')).toBe('C')
  })

  it('is deterministic and order-independent', () => {
    const a = mat('A', 'ROH', 50)
    const b = mat('B', 'ROH', 50)
    const m1 = abcClassify([a, b])
    const m2 = abcClassify([b, a])
    expect(m1.get('A')).toBe(m2.get('A'))
    expect(m1.get('B')).toBe(m2.get('B'))
  })

  it('falls back to all-C when total cost is zero', () => {
    const map = abcClassify([mat('A', 'ROH', 0), mat('B', 'ROH', 0)])
    expect([...map.values()]).toEqual(['C', 'C'])
  })

  it('returns an empty map for no materials', () => {
    expect(abcClassify([]).size).toBe(0)
  })
})

describe('abcCounts', () => {
  it('sums the classification into A/B/C buckets', () => {
    const c = abcCounts([mat('HI', 'ROH', 1000), mat('LO', 'ROH', 1)])
    expect(c.A + c.B + c.C).toBe(2)
  })
})

describe('whereUsedCounts / whereUsedParents', () => {
  const boms: Bom[] = [
    { bomId: 'B1', headerMaterialNo: 'FG1', headerDescription: 'FG1', components: [
      { materialNo: 'R1', description: 'r', qty: 1, uom: 'EA' },
      { materialNo: 'R2', description: 'r', qty: 2, uom: 'EA' },
    ] },
    { bomId: 'B2', headerMaterialNo: 'FG2', headerDescription: 'FG2', components: [
      { materialNo: 'R1', description: 'r', qty: 1, uom: 'EA' },
    ] },
  ]

  it('counts how many BOMs consume each component', () => {
    const c = whereUsedCounts(boms)
    expect(c.get('R1')).toBe(2)
    expect(c.get('R2')).toBe(1)
    expect(c.get('UNUSED')).toBeUndefined()
  })

  it('lists the parent material numbers for a component', () => {
    expect(whereUsedParents(boms, 'R1').sort()).toEqual(['FG1', 'FG2'])
    expect(whereUsedParents(boms, 'R2')).toEqual(['FG1'])
  })

  it('does not double-count a component listed twice in one BOM', () => {
    const dup: Bom[] = [{ bomId: 'B', headerMaterialNo: 'FG', headerDescription: '', components: [
      { materialNo: 'R1', description: 'r', qty: 1, uom: 'EA' },
      { materialNo: 'R1', description: 'r', qty: 1, uom: 'EA' },
    ] }]
    expect(whereUsedCounts(dup).get('R1')).toBe(1)
  })
})

describe('costTrend', () => {
  it('produces the requested number of points', () => {
    expect(costTrend('MAT-1', 100, 12)).toHaveLength(12)
  })

  it('lands exactly on the standard cost at the final point', () => {
    const t = costTrend('MAT-1', 250, 12)
    expect(t[t.length - 1]).toBeCloseTo(250, 0)
  })

  it('is deterministic across calls', () => {
    expect(costTrend('MAT-9', 80)).toEqual(costTrend('MAT-9', 80))
  })

  it('clamps to at least 1', () => {
    expect(Math.min(...costTrend('MAT-X', 2))).toBeGreaterThanOrEqual(1)
  })
})

describe('roleSplit', () => {
  it('splits partners by role', () => {
    const s = roleSplit([bp('1', 'customer', 'US', 1), bp('2', 'vendor', 'DE', 1), bp('3', 'both', 'JP', 1)])
    expect(s).toEqual({ customer: 1, vendor: 1, both: 1 })
  })
})

describe('regionCounts', () => {
  it('counts partners per country, descending', () => {
    const r = regionCounts([bp('1', 'customer', 'US', 1), bp('2', 'vendor', 'US', 1), bp('3', 'both', 'DE', 1)])
    expect(r[0]).toEqual({ label: 'US', value: 2 })
    expect(r[1]).toEqual({ label: 'DE', value: 1 })
  })
})

describe('compositeScore / topPartners', () => {
  it('scores within 0..100 and rewards higher credit', () => {
    const lo = compositeScore(bp('LO', 'customer', 'US', 1000))
    const hi = compositeScore(bp('HI', 'customer', 'US', 5_000_000))
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeLessThanOrEqual(100)
    expect(hi).toBeGreaterThan(lo)
  })

  it('returns top-N by score, deterministic', () => {
    const ps = [bp('A', 'customer', 'US', 1), bp('B', 'vendor', 'DE', 5_000_000), bp('C', 'both', 'JP', 100_000)]
    const top = topPartners(ps, 2)
    expect(top).toHaveLength(2)
    expect(top[0].bpNo).toBe('B')
  })
})

describe('locationOccupancy', () => {
  it('aggregates on-hand per location with shares summing to ~1', () => {
    const occ = locationOccupancy([inv('M1', 'L1', 30), inv('M2', 'L1', 10), inv('M3', 'L2', 60)])
    expect(occ[0].loc).toBe('L2')
    expect(occ[0].qty).toBe(60)
    expect(occ.find(o => o.loc === 'L1')?.skuCount).toBe(2)
    const sum = occ.reduce((s, o) => s + o.share, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('handles all-zero on-hand without dividing by zero', () => {
    const occ = locationOccupancy([inv('M1', 'L1', 0)])
    expect(occ[0].share).toBe(0)
  })
})

describe('poPipeline', () => {
  it('buckets POs into open / in-transit / received with late as a subset', () => {
    const p = poPipeline([
      po('1', 'V', 'open', '2026-01-01', '2026-01-10'),
      po('2', 'V', 'confirmed', '2026-01-01', '2026-01-10'),
      po('3', 'V', 'late', '2026-01-01', '2026-01-10'),
      po('4', 'V', 'received', '2026-01-01', '2026-01-10'),
    ])
    expect(p).toEqual({ open: 1, inTransit: 2, received: 1, late: 1 })
  })
})

describe('vendorOnTime', () => {
  it('drops the score for vendors with late POs', () => {
    const ranks = vendorOnTime([
      po('1', 'Good', 'received', '2026-01-01', '2026-01-10'),
      po('2', 'Bad', 'late', '2026-01-01', '2026-01-10'),
      po('3', 'Bad', 'late', '2026-01-01', '2026-01-10'),
    ])
    const good = ranks.find(r => r.label === 'Good')!
    const bad = ranks.find(r => r.label === 'Bad')!
    expect(good.value).toBeGreaterThan(bad.value)
    expect(ranks[0].label).toBe('Good')
  })
})

describe('deliveryWindowDays / daysBetween', () => {
  it('measures whole days between ISO dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10)
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10)
  })

  it('returns the order→delivery window, floored at 0', () => {
    expect(deliveryWindowDays(po('1', 'V', 'open', '2026-01-01', '2026-01-08'))).toBe(7)
    expect(deliveryWindowDays(po('2', 'V', 'open', '2026-01-08', '2026-01-01'))).toBe(0)
  })

  it('returns NaN for malformed dates', () => {
    expect(Number.isNaN(daysBetween('bad', '2026-01-01'))).toBe(true)
  })
})
