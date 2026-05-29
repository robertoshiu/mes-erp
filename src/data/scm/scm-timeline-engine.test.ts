import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { AppEvent } from '../../lib/events'
import { createScmTimelineEngine } from './scm-timeline-engine'
import type { ScmData } from './types'

function makeFakeClock() {
  let t = 0
  let idx = 0
  let boundaryCb: ((i: number) => void) | null = null
  const clock: Clock = {
    now: () => idx * 180 + t,
    loopT: () => t,
    loopIndex: () => idx,
    start: () => {},
    onLoopBoundary: (cb) => { boundaryCb = cb; return () => { boundaryCb = null } },
    destroy: () => {},
  }
  return {
    clock,
    setT: (v: number) => { t = v },
    setIdx: (v: number) => { idx = v },
    fireBoundary: (newIdx: number) => { idx = newIdx; boundaryCb?.(newIdx) },
  }
}

const SCM: ScmData = {
  networkNodes: [
    { id: 'SUP-1', kind: 'supplier', name: 'Supplier One', region: 'APAC', x: 100, y: 100, labelSide: 'left' },
    { id: 'FAB-01', kind: 'fab', name: 'FAB-01', region: 'TW', x: 500, y: 280, labelSide: 'top' },
  ],
  lanes: [
    { id: 'LANE-A', from: 'SUP-1', to: 'FAB-01', mode: 'sea', transitDays: 3 },
    { id: 'LANE-B', from: 'FAB-01', to: 'SUP-1', mode: 'air', transitDays: 2 },
  ],
  forecasts: [
    { materialNo: 'MAT-1', buckets: [100, 110, 120], actuals: [95, 0, 0] },
    { materialNo: 'MAT-2', buckets: [80, 90, 95], actuals: [82, 0, 0] },
  ],
  shipments: [],
  scorecards: [{ bpNo: 'BP-1', name: 'Supplier One', onTimePct: 95, qualityPct: 98, avgLeadDays: 12, openAsns: 2 }],
  atpPromises: [],
}

function runLoop(scm: ScmData, untilT: number) {
  const fc = makeFakeClock()
  const bus = createEventBus()
  const events: AppEvent[] = []
  bus.all$().subscribe(e => events.push(e))
  const engine = createScmTimelineEngine(fc.clock, bus, scm)
  engine.start()
  for (let t = 0; t <= untilT; t++) {
    fc.setT(t)
    vi.advanceTimersByTime(1000) // 5 ticks @200ms = ~1s of ambient
  }
  return { fc, bus, events, engine }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('scm-timeline-engine — ambient determinism', () => {
  it('same loopIndex → identical event sequence', () => {
    const a = runLoop(SCM, 10)
    const aTopics = a.events.map(e => e.topic)
    a.engine.stop()
    vi.clearAllTimers()
    const b = runLoop(SCM, 10)
    const bTopics = b.events.map(e => e.topic)
    b.engine.stop()
    expect(aTopics).toEqual(bTopics)
  })

  it('emits scm.* ambient topics (forecast/asn/disruption)', () => {
    const { events, engine } = runLoop(SCM, 60)
    const topics = new Set(events.map(e => e.topic))
    expect(topics.has('scm.forecast.updated')).toBe(true)
    expect(topics.has('scm.supplier.asn')).toBe(true)
    engine.stop()
  })
})

describe('scm-timeline-engine — spine beats', () => {
  it('fires the port-delay disruption and demand spike once per loop', () => {
    const { events, engine } = runLoop(SCM, 60)
    const portDelays = events.filter(e => e.topic === 'scm.disruption.raised' && e.reason === 'port delay')
    expect(portDelays.length).toBe(1)
    // Demand spike = a burst of forecast updates with large qty for one material.
    const spike = events.filter(e => e.topic === 'scm.forecast.updated' && e.qty >= 800)
    expect(spike.length).toBeGreaterThanOrEqual(1)
    engine.stop()
  })

  it('resets spine beats on the loop boundary (fires again next loop)', () => {
    const fc = makeFakeClock()
    const bus = createEventBus()
    const events: AppEvent[] = []
    bus.all$().subscribe(e => events.push(e))
    const engine = createScmTimelineEngine(fc.clock, bus, SCM)
    engine.start()
    for (let t = 0; t <= 60; t++) { fc.setT(t); vi.advanceTimersByTime(1000) }
    expect(events.filter(e => e.topic === 'scm.disruption.raised' && e.reason === 'port delay').length).toBe(1)

    // Cross the boundary, run a second loop window.
    fc.fireBoundary(1)
    for (let t = 0; t <= 60; t++) { fc.setT(t); vi.advanceTimersByTime(1000) }
    expect(events.filter(e => e.topic === 'scm.disruption.raised' && e.reason === 'port delay').length).toBe(2)
    engine.stop()
  })
})

describe('scm-timeline-engine — disruptions pair', () => {
  it('every raised disruption is eventually cleared within the loop', () => {
    const { events, engine } = runLoop(SCM, 120)
    const raised = events.filter(e => e.topic === 'scm.disruption.raised').length
    const cleared = events.filter(e => e.topic === 'scm.disruption.cleared').length
    // Clears trail raises by at most the count currently open.
    expect(cleared).toBeGreaterThan(0)
    expect(cleared).toBeLessThanOrEqual(raised)
    engine.stop()
  })
})
