import { describe, it, expect } from 'vitest'
import { normalizeMetric, buildKpiRadar } from './radar'
import type { KpiTickEvent } from '../../lib/events'

function kpi(over: Partial<KpiTickEvent>): KpiTickEvent {
  return {
    topic: 'kpi.tick',
    t: 0,
    oee: 0.7,
    yieldPct: 0.85,
    mtbfMinutes: 720,
    mttrMinutes: 30,
    wipTurn: 6,
    throughputUnitsPerHour: 300,
    cycleTimeMinutes: 40,
    ...over,
  }
}

describe('normalizeMetric', () => {
  it('maps the band endpoints to 0 and 100', () => {
    expect(normalizeMetric(0.4, 0.4, 1.0)).toBe(0)
    expect(normalizeMetric(1.0, 0.4, 1.0)).toBe(100)
  })

  it('maps the midpoint to 50', () => {
    expect(normalizeMetric(0.7, 0.4, 1.0)).toBeCloseTo(50, 5)
  })

  it('clamps out-of-band values', () => {
    expect(normalizeMetric(0.2, 0.4, 1.0)).toBe(0)
    expect(normalizeMetric(1.5, 0.4, 1.0)).toBe(100)
  })

  it('returns 0 for degenerate bands or non-finite input', () => {
    expect(normalizeMetric(5, 1, 1)).toBe(0)
    expect(normalizeMetric(5, 10, 1)).toBe(0)
    expect(normalizeMetric(NaN, 0, 10)).toBe(0)
  })
})

describe('buildKpiRadar', () => {
  it('produces 5 up-is-good axes', () => {
    const axes = buildKpiRadar(kpi({}))
    expect(axes.map(a => a.metric)).toEqual(['OEE', 'Yield', 'Throughput', 'WIP Turn', 'MTBF'])
    for (const a of axes) {
      expect(a.score).toBeGreaterThanOrEqual(0)
      expect(a.score).toBeLessThanOrEqual(100)
    }
  })

  it('reflects raw values in the score (higher OEE → higher score)', () => {
    const lo = buildKpiRadar(kpi({ oee: 0.5 }))[0].score
    const hi = buildKpiRadar(kpi({ oee: 0.9 }))[0].score
    expect(hi).toBeGreaterThan(lo)
  })

  it('returns all-zero axes for a null snapshot', () => {
    const axes = buildKpiRadar(null)
    expect(axes).toHaveLength(5)
    expect(axes.every(a => a.score === 0)).toBe(true)
  })
})
