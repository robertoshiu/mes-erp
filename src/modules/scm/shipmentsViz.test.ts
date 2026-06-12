import { describe, it, expect } from 'vitest'
import { modeSplit, busiestLanes } from './shipmentsViz'
import type { Shipment, LaneMode } from '../../data/scm/types'

/** Minimal Shipment factory — only the fields the viz helpers read matter. */
function ship(over: Partial<Shipment> & { shipmentNo: string }): Shipment {
  return {
    shipmentNo: over.shipmentNo,
    direction: over.direction ?? 'inbound',
    fromNode: over.fromNode ?? 'N1',
    toNode: over.toNode ?? 'N2',
    laneId: over.laneId ?? 'L1',
    refDoc: over.refDoc ?? {},
    materialNo: over.materialNo ?? 'M1',
    qty: over.qty ?? 1,
    status: over.status ?? 'in-transit',
    departureT: over.departureT ?? 0,
    transitSeconds: over.transitSeconds ?? 10,
  }
}

describe('modeSplit', () => {
  const modes = new Map<string, LaneMode>([
    ['LA', 'air'],
    ['LS', 'sea'],
    ['LT', 'truck'],
  ])

  it('counts shipments by their lane mode', () => {
    const s = modeSplit(
      [
        ship({ shipmentNo: 'S1', laneId: 'LA' }),
        ship({ shipmentNo: 'S2', laneId: 'LA' }),
        ship({ shipmentNo: 'S3', laneId: 'LS' }),
        ship({ shipmentNo: 'S4', laneId: 'LT' }),
      ],
      modes,
    )
    expect(s).toEqual({ air: 2, sea: 1, truck: 1, total: 4 })
  })

  it('skips shipments whose lane is unknown (never invents a bucket)', () => {
    const s = modeSplit([ship({ shipmentNo: 'S1', laneId: 'GHOST' })], modes)
    expect(s).toEqual({ air: 0, sea: 0, truck: 0, total: 0 })
  })

  it('returns an all-zero split for an empty set', () => {
    expect(modeSplit([], modes)).toEqual({ air: 0, sea: 0, truck: 0, total: 0 })
  })
})

describe('busiestLanes', () => {
  const nameOf = (id: string) => ({ N1: 'Alpha', N2: 'Beta', N3: 'Gamma' }[id] ?? id)

  it('ranks lanes by in-flight shipment count, descending', () => {
    const ranked = busiestLanes(
      [
        ship({ shipmentNo: 'S1', laneId: 'L1', fromNode: 'N1', toNode: 'N2' }),
        ship({ shipmentNo: 'S2', laneId: 'L1', fromNode: 'N1', toNode: 'N2' }),
        ship({ shipmentNo: 'S3', laneId: 'L2', fromNode: 'N2', toNode: 'N3' }),
      ],
      nameOf,
    )
    expect(ranked[0]).toEqual({ laneId: 'L1', label: 'Alpha → Beta', count: 2 })
    expect(ranked[1]).toEqual({ laneId: 'L2', label: 'Beta → Gamma', count: 1 })
  })

  it('breaks ties on label and caps at `top`', () => {
    const ships = [
      ship({ shipmentNo: 'A', laneId: 'L1', fromNode: 'N2', toNode: 'N3' }),
      ship({ shipmentNo: 'B', laneId: 'L2', fromNode: 'N1', toNode: 'N2' }),
      ship({ shipmentNo: 'C', laneId: 'L3', fromNode: 'N1', toNode: 'N3' }),
    ]
    const ranked = busiestLanes(ships, nameOf, 2)
    expect(ranked).toHaveLength(2)
    // All count 1 → label order: "Alpha → Beta", "Alpha → Gamma", "Beta → Gamma".
    expect(ranked.map(r => r.label)).toEqual(['Alpha → Beta', 'Alpha → Gamma'])
  })

  it('is pure — does not mutate the input array', () => {
    const ships = [ship({ shipmentNo: 'A' }), ship({ shipmentNo: 'B' })]
    const before = ships.map(s => s.shipmentNo)
    busiestLanes(ships, nameOf)
    expect(ships.map(s => s.shipmentNo)).toEqual(before)
  })
})
