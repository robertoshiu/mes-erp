import { describe, it, expect } from 'vitest'
import { pushSpark, rollSpark, emptySpark, sparkPoints, SPARK_BUCKETS } from './laneSpark'

describe('emptySpark', () => {
  it('is a fixed-width zeroed history', () => {
    const h = emptySpark()
    expect(h).toHaveLength(SPARK_BUCKETS)
    expect(h.every(v => v === 0)).toBe(true)
  })
})

describe('pushSpark', () => {
  it('adds activity to the newest (last) bucket without mutating input', () => {
    const h = emptySpark()
    const next = pushSpark(h, 3)
    expect(next[SPARK_BUCKETS - 1]).toBe(3)
    expect(h[SPARK_BUCKETS - 1]).toBe(0) // input untouched
  })

  it('defaults the increment to 1 and accumulates', () => {
    let h = emptySpark()
    h = pushSpark(h)
    h = pushSpark(h)
    expect(h[SPARK_BUCKETS - 1]).toBe(2)
  })

  it('normalizes a malformed/short history to full width', () => {
    const next = pushSpark([1, 2], 5)
    expect(next).toHaveLength(SPARK_BUCKETS)
    expect(next[SPARK_BUCKETS - 1]).toBe(5)
  })
})

describe('rollSpark', () => {
  it('shifts left and opens a fresh zero bucket', () => {
    const h = emptySpark()
    h[SPARK_BUCKETS - 1] = 9
    const rolled = rollSpark(h)
    expect(rolled).toHaveLength(SPARK_BUCKETS)
    expect(rolled[SPARK_BUCKETS - 1]).toBe(0)
    expect(rolled[SPARK_BUCKETS - 2]).toBe(9)
  })
})

describe('sparkPoints', () => {
  it('returns a point per bucket', () => {
    const pts = sparkPoints(emptySpark(), 40, 12).split(' ')
    expect(pts).toHaveLength(SPARK_BUCKETS)
  })

  it('maps the max value to the top (smallest y) and zero to baseline', () => {
    const h = emptySpark()
    h[0] = 10 // peak at start
    const pts = sparkPoints(h, 40, 12, 1).split(' ').map(p => p.split(',').map(Number))
    const ys = pts.map(p => p[1])
    expect(Math.min(...ys)).toBe(ys[0]) // peak bucket is highest (smallest y)
    expect(ys[1]).toBeGreaterThan(ys[0]) // zero buckets sit at baseline below
  })

  it('returns empty string for an empty history', () => {
    expect(sparkPoints([], 40, 12)).toBe('')
  })
})
