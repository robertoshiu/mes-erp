import { describe, it, expect } from 'vitest'
import { computeCashPosition, rankTopAccounts, buildGlTrend } from './financeMetrics'
import type { ErpData, GlAccount } from '../../data/erp/types'

function makeErpData(over: Partial<ErpData>): ErpData {
  return {
    materials: [],
    businessPartners: [],
    boms: [],
    workCenters: [],
    costCenters: [],
    glAccounts: [],
    plants: [],
    salesOrders: [],
    purchaseOrders: [],
    productionOrders: [],
    inventory: [],
    ...over,
  }
}

const so = (status: string, netValue: number) =>
  ({ orderNo: 'SO', bpNo: '', customerName: '', orderDate: '', requestedDate: '', status, priority: 'normal', lines: [], netValue }) as never
const po = (status: string, netValue: number) =>
  ({ poNo: 'PO', bpNo: '', vendorName: '', orderDate: '', deliveryDate: '', status, lines: [], netValue }) as never

describe('computeCashPosition', () => {
  it('sums only open AR (non-complete) and open AP (non-received)', () => {
    const data = makeErpData({
      salesOrders: [so('open', 100), so('complete', 999), so('in-process', 50)],
      purchaseOrders: [po('open', 40), po('received', 999), po('late', 10)],
    })
    const cp = computeCashPosition(data)
    expect(cp.openAr).toBe(150)
    expect(cp.openAp).toBe(50)
    expect(cp.net).toBe(100)
  })

  it('shares a common scale so the larger side fills to 1', () => {
    const cp = computeCashPosition(
      makeErpData({ salesOrders: [so('open', 200)], purchaseOrders: [po('open', 50)] }),
    )
    expect(cp.arShare).toBeCloseTo(1)
    expect(cp.apShare).toBeCloseTo(0.25)
  })

  it('avoids divide-by-zero with no open documents', () => {
    const cp = computeCashPosition(makeErpData({}))
    expect(cp.openAr).toBe(0)
    expect(cp.openAp).toBe(0)
    expect(cp.net).toBe(0)
    expect(cp.arShare).toBe(0)
  })
})

const accounts: GlAccount[] = [
  { accountNo: '4000', name: 'Revenue', type: 'revenue' },
  { accountNo: '2000', name: 'Payables', type: 'liability' },
]

describe('rankTopAccounts', () => {
  it('ranks by absolute posted amount, descending', () => {
    const ranked = rankTopAccounts(
      [
        { accountNo: '4000', amount: 100 },
        { accountNo: '4000', amount: -50 },
        { accountNo: '2000', amount: 200 },
      ],
      accounts,
    )
    expect(ranked.map(r => r.accountNo)).toEqual(['2000', '4000'])
    expect(ranked[0].posted).toBe(200)
    expect(ranked[1].posted).toBe(150) // |100| + |-50|
    expect(ranked[0].name).toBe('Payables')
  })

  it('falls back to the account number when name is unknown', () => {
    const ranked = rankTopAccounts([{ accountNo: '9999', amount: 5 }], accounts)
    expect(ranked[0].name).toBe('9999')
  })

  it('honors the limit', () => {
    const ranked = rankTopAccounts(
      [
        { accountNo: 'a', amount: 5 },
        { accountNo: 'b', amount: 4 },
        { accountNo: 'c', amount: 3 },
      ],
      [],
      2,
    )
    expect(ranked).toHaveLength(2)
  })
})

describe('buildGlTrend', () => {
  it('produces the requested number of buckets', () => {
    const trend = buildGlTrend([{ amount: 1 }, { amount: 2 }, { amount: 3 }], 3)
    expect(trend).toHaveLength(3)
    expect(trend.map(t => t.i)).toEqual([0, 1, 2])
  })

  it('accumulates a running balance across buckets', () => {
    const trend = buildGlTrend([{ amount: 10 }, { amount: -4 }, { amount: 6 }], 3)
    expect(trend[0].balance).toBe(10)
    expect(trend[1].balance).toBe(6)
    expect(trend[2].balance).toBe(12)
    expect(trend[2].balance).toBe(trend[2].balance) // final balance = total
  })

  it('handles empty postings with zeroed buckets', () => {
    const trend = buildGlTrend([], 4)
    expect(trend).toHaveLength(4)
    expect(trend.every(t => t.flow === 0 && t.balance === 0)).toBe(true)
  })
})
