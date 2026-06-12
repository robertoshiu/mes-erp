import { describe, it, expect } from 'vitest'
import { seasonalityMatrix, forecastAccuracy } from './demandViz'
import type { DemandPlan } from './demandViz'

function plan(materialNo: string, buckets: number[], actuals: number[]): DemandPlan {
  return { materialNo, buckets, actuals }
}

describe('seasonalityMatrix', () => {
  it('normalizes each row to its own peak bucket', () => {
    const m = seasonalityMatrix([plan('A', [50, 100, 25, 0], [0, 0, 0, 0])])
    expect(m[0].cells.map(c => c.intensity)).toEqual([0.5, 1, 0.25, 0])
    expect(m[0].cells.map(c => c.qty)).toEqual([50, 100, 25, 0])
  })

  it('ranks rows by total forecast volume, descending', () => {
    const m = seasonalityMatrix([
      plan('LOW', [10, 10], [0, 0]),
      plan('HIGH', [90, 90], [0, 0]),
    ])
    expect(m.map(r => r.materialNo)).toEqual(['HIGH', 'LOW'])
    expect(m[0].total).toBe(180)
  })

  it('breaks ties on materialNo and caps at topN', () => {
    const plans = [
      plan('C', [10, 10], [0, 0]),
      plan('A', [10, 10], [0, 0]),
      plan('B', [10, 10], [0, 0]),
    ]
    const m = seasonalityMatrix(plans, 2)
    expect(m.map(r => r.materialNo)).toEqual(['A', 'B'])
  })

  it('handles an all-zero forecast row without dividing by zero', () => {
    const m = seasonalityMatrix([plan('Z', [0, 0, 0], [0, 0, 0])])
    expect(m[0].cells.every(c => c.intensity === 0)).toBe(true)
  })

  it('is pure — does not mutate the input array', () => {
    const plans = [plan('B', [1], [0]), plan('A', [9], [0])]
    const before = plans.map(p => p.materialNo)
    seasonalityMatrix(plans)
    expect(plans.map(p => p.materialNo)).toEqual(before)
  })
})

describe('forecastAccuracy', () => {
  it('returns 100 when actuals match forecast exactly', () => {
    expect(forecastAccuracy(plan('A', [100, 50], [100, 50]))).toBe(100)
  })

  it('subtracts the mean absolute percentage error', () => {
    // |80-100| + |60-50| = 30 abs err over 150 forecast → 20% MAPE → 80% accuracy.
    expect(forecastAccuracy(plan('A', [100, 50], [80, 60]))).toBeCloseTo(80)
  })

  it('floors at 0 for wild over/under runs', () => {
    expect(forecastAccuracy(plan('A', [10], [100]))).toBe(0)
  })

  it('reports 0 for a zero-forecast plan', () => {
    expect(forecastAccuracy(plan('A', [0, 0], [5, 5]))).toBe(0)
  })
})
