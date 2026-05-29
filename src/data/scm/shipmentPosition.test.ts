import { describe, it, expect } from 'vitest'
import { shipmentPosition } from './shipmentPosition'

describe('shipmentPosition — clamping', () => {
  it('returns 0 before departure (loopT < departureT)', () => {
    expect(shipmentPosition(5, 20, 40)).toBe(0)
  })

  it('returns exactly 0 at departure', () => {
    expect(shipmentPosition(20, 20, 40)).toBe(0)
  })

  it('returns 0.5 at the lane midpoint', () => {
    expect(shipmentPosition(40, 20, 40)).toBeCloseTo(0.5, 10)
  })

  it('returns exactly 1 at arrival (loopT == departureT + transit)', () => {
    expect(shipmentPosition(60, 20, 40)).toBe(1)
  })

  it('clamps to 1 after arrival (loopT > departureT + transit)', () => {
    expect(shipmentPosition(200, 20, 40)).toBe(1)
  })

  it('stays within [0,1] across a sweep of loopT values', () => {
    const departureT = 12
    const transit = 30
    for (let t = -50; t <= 200; t += 0.37) {
      const p = shipmentPosition(t, departureT, transit)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  it('handles a negative departureT (seeded already-in-flight, ARCH-2 spread)', () => {
    // departureT before the loop origin -> dot already mid-lane at loopT 0.
    const p = shipmentPosition(0, -10, 40)
    expect(p).toBeCloseTo(0.25, 10)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })

  it('treats non-positive transitSeconds as instantaneous (no div-by-zero)', () => {
    expect(shipmentPosition(5, 5, 0)).toBe(1)
    expect(shipmentPosition(4, 5, 0)).toBe(0)
    expect(shipmentPosition(10, 5, -3)).toBe(1)
  })
})
