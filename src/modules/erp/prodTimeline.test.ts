import { describe, it, expect } from 'vitest'
import { ganttBarFor, buildGantt, TODAY_REF } from './prodTimeline'
import type { ProductionOrder, ProdOrderStatus } from '../../data/erp/types'

function order(over: Partial<ProductionOrder> & { orderNo: string; status: ProdOrderStatus }): ProductionOrder {
  return {
    orderNo: over.orderNo,
    materialNo: over.materialNo ?? 'M1',
    description: over.description ?? over.orderNo,
    routeId: over.routeId ?? 'R1',
    targetQty: over.targetQty ?? 100,
    status: over.status,
    salesOrderNo: over.salesOrderNo ?? null,
    lotId: over.lotId ?? null,
  }
}

describe('ganttBarFor', () => {
  it('produces bars within the 0..1 axis with positive width', () => {
    for (const status of ['Created', 'Released', 'InProcess', 'Completed'] as ProdOrderStatus[]) {
      const bar = ganttBarFor(order({ orderNo: `PO-${status}`, status }))
      expect(bar.start).toBeGreaterThanOrEqual(0)
      expect(bar.end).toBeLessThanOrEqual(1)
      expect(bar.end).toBeGreaterThan(bar.start)
    }
  })

  it('is deterministic — identical input yields identical bar', () => {
    const o = order({ orderNo: 'PO-DET-1', status: 'InProcess', targetQty: 250 })
    expect(ganttBarFor(o)).toEqual(ganttBarFor(o))
  })

  it('places Completed orders ending before today', () => {
    const bar = ganttBarFor(order({ orderNo: 'PO-DONE', status: 'Completed' }))
    expect(bar.end).toBeLessThanOrEqual(TODAY_REF)
  })

  it('places Created orders starting after today', () => {
    const bar = ganttBarFor(order({ orderNo: 'PO-NEW', status: 'Created' }))
    expect(bar.start).toBeGreaterThan(TODAY_REF)
  })

  it('straddles today for InProcess orders', () => {
    const bar = ganttBarFor(order({ orderNo: 'PO-WIP', status: 'InProcess' }))
    expect(bar.start).toBeLessThanOrEqual(TODAY_REF)
    expect(bar.end).toBeGreaterThanOrEqual(TODAY_REF)
  })
})

describe('buildGantt', () => {
  it('orders in-flight statuses ahead of completed', () => {
    const orders = [
      order({ orderNo: 'A', status: 'Completed' }),
      order({ orderNo: 'B', status: 'InProcess' }),
      order({ orderNo: 'C', status: 'Created' }),
      order({ orderNo: 'D', status: 'Released' }),
    ]
    const bars = buildGantt(orders)
    expect(bars.map(b => b.status)).toEqual(['InProcess', 'Released', 'Created', 'Completed'])
  })

  it('caps the result at the limit', () => {
    const orders = Array.from({ length: 30 }, (_, i) =>
      order({ orderNo: `PO-${i}`, status: 'InProcess' }),
    )
    expect(buildGantt(orders, 14)).toHaveLength(14)
    expect(buildGantt(orders, 6)).toHaveLength(6)
  })

  it('does not mutate the input array', () => {
    const orders = [order({ orderNo: 'Z', status: 'Created' }), order({ orderNo: 'A', status: 'InProcess' })]
    const before = orders.map(o => o.orderNo)
    buildGantt(orders)
    expect(orders.map(o => o.orderNo)).toEqual(before)
  })
})
