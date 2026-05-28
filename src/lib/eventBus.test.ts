import { describe, it, expect } from 'vitest'
import { createEventBus } from './eventBus'
import type { MesEvent, LotMoveEvent, EquipStateEvent } from './events'

function makeLotMove(t: number, lotId = 'LOT-001'): LotMoveEvent {
  return {
    topic: 'lot.move', t, lotId,
    fromToolId: 'EQP-LITHO-01', toToolId: 'EQP-ETCH-01',
    routeStep: 1, operatorId: 'OP-001',
    productCode: 'DEV-7NM-A1', customerName: 'ACME-SEMI',
  }
}

function makeEquipState(t: number, toolId = 'EQP-LITHO-01'): EquipStateEvent {
  return {
    topic: 'equip.state', t, toolId,
    fromState: 'PROD', toState: 'STBY',
  }
}

describe('eventBus', () => {
  it('publishes events to topic-filtered subscribers', () => {
    const bus = createEventBus()
    const received: LotMoveEvent[] = []
    const sub = bus.ofTopic('lot.move').subscribe(e => received.push(e))

    bus.publish(makeLotMove(0))
    bus.publish(makeEquipState(1))
    bus.publish(makeLotMove(2))

    expect(received).toHaveLength(2)
    expect(received[0].t).toBe(0)
    expect(received[1].t).toBe(2)
    sub.unsubscribe()
    bus.destroy()
  })

  it('ring buffer holds last N events', () => {
    const bus = createEventBus(5) // small buffer for test
    for (let i = 0; i < 10; i++) {
      bus.publish(makeLotMove(i))
    }
    const buffer = bus.getBuffer()
    expect(buffer).toHaveLength(5)
    expect(buffer[0].t).toBe(5)
    expect(buffer[4].t).toBe(9)
    bus.destroy()
  })

  it('ring buffer emits via observable', () => {
    const bus = createEventBus(3)
    const snapshots: MesEvent[][] = []
    const sub = bus.ringBuffer$().subscribe(buf => snapshots.push([...buf]))

    bus.publish(makeLotMove(0))
    bus.publish(makeLotMove(1))
    bus.publish(makeLotMove(2))
    bus.publish(makeLotMove(3))

    // Each publish triggers a new snapshot
    expect(snapshots.length).toBe(4)
    // Last snapshot should have events 1,2,3 (buffer size 3)
    expect(snapshots[3]).toHaveLength(3)
    expect(snapshots[3][0].t).toBe(1)
    sub.unsubscribe()
    bus.destroy()
  })

  it('all$ emits all events regardless of topic', () => {
    const bus = createEventBus()
    const received: MesEvent[] = []
    const sub = bus.all$().subscribe(e => received.push(e))

    bus.publish(makeLotMove(0))
    bus.publish(makeEquipState(1))

    expect(received).toHaveLength(2)
    sub.unsubscribe()
    bus.destroy()
  })

  it('publishBatch emits multiple events synchronously', () => {
    const bus = createEventBus()
    const received: MesEvent[] = []
    const sub = bus.all$().subscribe(e => received.push(e))

    bus.publishBatch([makeLotMove(0), makeLotMove(1), makeEquipState(2)])

    expect(received).toHaveLength(3)
    sub.unsubscribe()
    bus.destroy()
  })
})
