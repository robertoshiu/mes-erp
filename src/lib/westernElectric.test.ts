import { describe, it, expect } from 'vitest'
import { checkWesternElectric, type ControlPoint } from './westernElectric'

function makePoints(values: number[], ucl = 100, lcl = 0, centerline = 50): ControlPoint[] {
  return values.map((value, i) => ({ value, ucl, lcl, centerline, index: i }))
}

describe('Western Electric Rules', () => {
  describe('Rule 1: single point beyond 3-sigma', () => {
    it('detects point above UCL', () => {
      const points = makePoints([50, 50, 50, 101])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 1, index: 3 }))
    })

    it('detects point below LCL', () => {
      const points = makePoints([50, 50, 50, -1])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 1, index: 3 }))
    })

    it('does not fire for point within limits', () => {
      const points = makePoints([50, 60, 40, 99])
      const violations = checkWesternElectric(points)
      const rule1 = violations.filter(v => v.rule === 1)
      expect(rule1).toHaveLength(0)
    })
  })

  describe('Rule 2: 9 consecutive points on same side of centerline', () => {
    it('detects 9 consecutive above centerline', () => {
      const points = makePoints([51, 52, 53, 54, 55, 56, 57, 58, 59])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 2, index: 8 }))
    })

    it('does not fire for 8 consecutive', () => {
      const points = makePoints([51, 52, 53, 54, 55, 56, 57, 58])
      const violations = checkWesternElectric(points)
      const rule2 = violations.filter(v => v.rule === 2)
      expect(rule2).toHaveLength(0)
    })

    it('detects 9 consecutive below centerline', () => {
      const points = makePoints([49, 48, 47, 46, 45, 44, 43, 42, 41])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 2, index: 8 }))
    })

    it('resets when point crosses centerline', () => {
      const points = makePoints([51, 52, 53, 54, 49, 56, 57, 58, 59, 60, 61, 62, 63])
      const violations = checkWesternElectric(points)
      const rule2 = violations.filter(v => v.rule === 2)
      // After crossing at index 4, consecutive count resets. 5,6,7,8,9,10,11,12 = 8 above. Not 9.
      expect(rule2).toHaveLength(0)
    })
  })

  describe('Rule 4: 14 consecutive alternating up-down', () => {
    it('detects 14 alternating points', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 4, index: 13 }))
    })

    it('does not fire for 13 alternating', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45])
      const violations = checkWesternElectric(points)
      const rule4 = violations.filter(v => v.rule === 4)
      expect(rule4).toHaveLength(0)
    })

    it('resets when alternation breaks', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 55, 45, 55, 45, 55, 45, 55, 45, 55])
      const violations = checkWesternElectric(points)
      const rule4 = violations.filter(v => v.rule === 4)
      // Break at index 5→6 (both go up). Reset.
      expect(rule4).toHaveLength(0)
    })
  })
})
