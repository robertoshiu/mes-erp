import { describe, it, expect, beforeEach } from 'vitest'
import { useShipments, MAX_SHIPMENTS } from './useShipments'
import type { Shipment } from '../data/scm/types'

function ship(n: number): Shipment {
  return {
    shipmentNo: `SHP-${n}`,
    direction: n % 2 === 0 ? 'inbound' : 'outbound',
    fromNode: 'SUP-1', toNode: 'FAB-01', laneId: 'LANE-IN',
    refDoc: { poNo: `PO-${n}` },
    materialNo: 'MAT-1', qty: 10,
    status: 'created', departureT: 0, transitSeconds: 12,
  }
}

beforeEach(() => useShipments.getState().reset())

describe('useShipments', () => {
  it('addShipment appends', () => {
    useShipments.getState().addShipment(ship(1))
    expect(useShipments.getState().shipments).toHaveLength(1)
    expect(useShipments.getState().shipments[0].shipmentNo).toBe('SHP-1')
  })

  it('caps + recycles at MAX_SHIPMENTS (keeps the newest)', () => {
    for (let i = 0; i < MAX_SHIPMENTS + 10; i++) useShipments.getState().addShipment(ship(i))
    const s = useShipments.getState().shipments
    expect(s).toHaveLength(MAX_SHIPMENTS)
    // Oldest dropped, newest retained.
    expect(s[0].shipmentNo).toBe(`SHP-10`)
    expect(s[s.length - 1].shipmentNo).toBe(`SHP-${MAX_SHIPMENTS + 9}`)
  })

  it('transition updates only the matching shipment status', () => {
    useShipments.getState().addShipment(ship(1))
    useShipments.getState().addShipment(ship(2))
    useShipments.getState().transition('SHP-1', 'in-transit')
    const s = useShipments.getState().shipments
    expect(s.find(x => x.shipmentNo === 'SHP-1')!.status).toBe('in-transit')
    expect(s.find(x => x.shipmentNo === 'SHP-2')!.status).toBe('created')
  })

  it('reset empties the store', () => {
    useShipments.getState().addShipment(ship(1))
    useShipments.getState().reset()
    expect(useShipments.getState().shipments).toHaveLength(0)
  })
})
