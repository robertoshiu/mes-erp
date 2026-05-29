import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createErpTimelineEngine } from './erp-timeline-engine'
import { generateMasterData } from '../master'
import { generateErpData } from './index'
import type { Clock } from '../../lib/clock'
import type { AppEvent } from '../../lib/events'

const md = generateMasterData()
const erp = generateErpData(md)

// A deterministic stub clock pinned to a fixed loopIndex / loopT so the
// engine's ambient stream is governed solely by seededRng(loopIndex, 1000).
// No boundary crossing fires (loopIndex never changes), so the spine beats
// don't perturb the early ambient sequence we sample at t≈10.
function stubClock(loopIndex: number, loopT: number): Clock {
  return {
    now: () => loopIndex * 180 + loopT,
    loopT: () => loopT,
    loopIndex: () => loopIndex,
    start: () => {},
    onLoopBoundary: () => () => {},
    destroy: () => {},
  }
}

// Capture-only event bus — records what the engine publishes.
function captureBus() {
  const events: AppEvent[] = []
  return {
    events,
    bus: {
      publish: (e: AppEvent) => { events.push(e) },
      publishBatch: (es: AppEvent[]) => { events.push(...es) },
      all$: () => { throw new Error('unused') },
      ofTopic: () => { throw new Error('unused') },
      ringBuffer$: () => { throw new Error('unused') },
      getBuffer: () => events.slice(),
      destroy: () => {},
    } as any,
  }
}

// Run the engine for `ticks` 200ms ticks at a fixed loopIndex and return the
// captured event stream (spine beats kept off the sampled window by pinning t<25).
function runAmbient(loopIndex: number, ticks = 60) {
  vi.useFakeTimers()
  const { events, bus } = captureBus()
  const eng = createErpTimelineEngine(stubClock(loopIndex, 10), bus, erp)
  eng.start()
  vi.advanceTimersByTime(ticks * 200)
  eng.stop()
  vi.useRealTimers()
  return events
}

describe('erp-timeline-engine — ambient determinism (ARCH-3 regression)', () => {
  beforeEach(() => { vi.useRealTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('produces an identical ambient stream for the same loopIndex (deterministic)', () => {
    const a = runAmbient(0)
    const b = runAmbient(0)
    expect(a.length).toBeGreaterThan(0)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('produces a different stream for a different loopIndex (seed varies)', () => {
    const a = runAmbient(0)
    const c = runAmbient(1)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })

  it('still emits ambient goods-movement GR after the ARCH-3 damp (present, not zero)', () => {
    // Sample a long window so the narrowed GR band is reliably exercised.
    const events = runAmbient(0, 400)
    const gr = events.filter(
      e => e.topic === 'erp.goods.movement' && (e as any).movementType === 'GR',
    )
    expect(gr.length).toBeGreaterThan(0)
  })

  it('keeps ambient GR a MINORITY of the stream (the damp reduced its share)', () => {
    const events = runAmbient(0, 400)
    const ambientCount = events.length
    const grCount = events.filter(e => e.topic === 'erp.goods.movement').length
    expect(ambientCount).toBeGreaterThan(0)
    // The goods.movement band is now roll∈[0.5,0.6) — ~10% of the ambient roll
    // space — so it must stay well under a third of all ambient events.
    expect(grCount / ambientCount).toBeLessThan(0.33)
  })

  it('emits a coherent mix of ERP ambient topics (stream is not degenerate)', () => {
    const events = runAmbient(0, 400)
    const topics = new Set(events.map(e => e.topic))
    // Several distinct ambient topics must still appear alongside the damped GR.
    expect(topics.size).toBeGreaterThanOrEqual(3)
    expect(topics.has('erp.goods.movement')).toBe(true)
  })
})
