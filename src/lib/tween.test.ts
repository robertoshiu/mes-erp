import { describe, it, expect } from 'vitest'
import { easeOutCubic, clamp01, tweenValue } from './tween'

describe('clamp01', () => {
  it('clamps below 0 and above 1', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
  })

  it('passes through values in range', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.42)).toBeCloseTo(0.42)
    expect(clamp01(1)).toBe(1)
  })
})

describe('easeOutCubic', () => {
  it('anchors the endpoints', () => {
    expect(easeOutCubic(0)).toBeCloseTo(0)
    expect(easeOutCubic(1)).toBeCloseTo(1)
  })

  it('is fast-out (past halfway at t=0.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })

  it('clamps out-of-range inputs', () => {
    expect(easeOutCubic(-1)).toBeCloseTo(0)
    expect(easeOutCubic(2)).toBeCloseTo(1)
  })
})

describe('tweenValue', () => {
  it('returns the start at elapsed 0', () => {
    expect(tweenValue(10, 50, 0, 600)).toBeCloseTo(10)
  })

  it('snaps to target at/after the duration', () => {
    expect(tweenValue(10, 50, 600, 600)).toBeCloseTo(50)
    expect(tweenValue(10, 50, 900, 600)).toBeCloseTo(50)
  })

  it('returns the target immediately for non-positive duration', () => {
    expect(tweenValue(10, 50, 0, 0)).toBe(50)
    expect(tweenValue(10, 50, 5, -1)).toBe(50)
  })

  it('interpolates monotonically toward the target', () => {
    const a = tweenValue(0, 100, 150, 600)
    const b = tweenValue(0, 100, 300, 600)
    const c = tweenValue(0, 100, 450, 600)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
    expect(c).toBeLessThan(100)
  })

  it('handles a decreasing target', () => {
    const mid = tweenValue(100, 0, 300, 600)
    expect(mid).toBeLessThan(100)
    expect(mid).toBeGreaterThan(0)
  })
})
