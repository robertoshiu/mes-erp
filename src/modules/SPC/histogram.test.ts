import { describe, it, expect } from 'vitest'
import { binValues } from './histogram'

describe('binValues', () => {
  it('produces binCount evenly-spaced bins spanning the domain', () => {
    const bins = binValues([], 0, 10, 5)
    expect(bins).toHaveLength(5)
    expect(bins[0].x0).toBe(0)
    expect(bins[4].x1).toBe(10)
    expect(bins.map(b => b.center)).toEqual([1, 3, 5, 7, 9])
  })

  it('counts each value into its bucket', () => {
    // One value per distinct bin: 1→[0,2), 3→[2,4), 5→[4,6), 7→[6,8), 9.9→[8,10]
    const bins = binValues([1, 3, 5, 7, 9.9], 0, 10, 5)
    expect(bins.map(b => b.count)).toEqual([1, 1, 1, 1, 1])
  })

  it('groups multiple values in the same bin', () => {
    const bins = binValues([0.5, 1.5, 1.9], 0, 10, 5)
    expect(bins[0].count).toBe(3)
    const total = bins.reduce((a, b) => a + b.count, 0)
    expect(total).toBe(3)
  })

  it('clamps out-of-domain values into the edge bins instead of dropping them', () => {
    const bins = binValues([-5, 15], 0, 10, 5)
    expect(bins[0].count).toBe(1) // -5 clamped to 0
    expect(bins[4].count).toBe(1) // 15 clamped into last bin
  })

  it('places a value exactly on the upper edge into the final bin', () => {
    const bins = binValues([10], 0, 10, 5)
    expect(bins[4].count).toBe(1)
  })

  it('ignores non-finite values', () => {
    const bins = binValues([NaN, Infinity, 5], 0, 10, 5)
    const total = bins.reduce((a, b) => a + b.count, 0)
    expect(total).toBe(1)
  })

  it('returns empty for degenerate inputs', () => {
    expect(binValues([1, 2], 0, 10, 0)).toEqual([])
    expect(binValues([1, 2], 10, 10, 5)).toEqual([])
    expect(binValues([1, 2], 10, 0, 5)).toEqual([])
  })
})
