import { describe, it, expect } from 'vitest'
import { mulberry32, cyrb53 } from './prng'

describe('mulberry32', () => {
  it('returns deterministic sequence for a given seed', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('has reasonable distribution (chi-squared sanity)', () => {
    const rng = mulberry32(999)
    const buckets = new Array(10).fill(0)
    const N = 10000
    for (let i = 0; i < N; i++) {
      buckets[Math.floor(rng() * 10)]++
    }
    // Each bucket should be ~1000. Allow 20% deviation.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800)
      expect(count).toBeLessThan(1200)
    }
  })

  it('helper: pick returns element from array deterministically', () => {
    // Test after pick is implemented
  })
})

describe('cyrb53', () => {
  it('returns consistent hash for same input', () => {
    expect(cyrb53('hello')).toBe(cyrb53('hello'))
  })

  it('returns different hash for different inputs', () => {
    expect(cyrb53('hello')).not.toBe(cyrb53('world'))
  })

  it('accepts an optional seed', () => {
    expect(cyrb53('hello', 0)).not.toBe(cyrb53('hello', 1))
  })
})
