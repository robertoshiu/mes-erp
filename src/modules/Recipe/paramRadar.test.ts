import { describe, it, expect } from 'vitest'
import { parseParamNumber, buildParamRadar } from './paramRadar'

describe('parseParamNumber', () => {
  it('parses positive, negative and decimal tokens', () => {
    expect(parseParamNumber('640')).toBe(640)
    expect(parseParamNumber('-50')).toBe(-50)
    expect(parseParamNumber('3.2')).toBeCloseTo(3.2)
  })

  it('returns null for non-numeric strings', () => {
    expect(parseParamNumber('ATHENA')).toBeNull()
    expect(parseParamNumber('')).toBeNull()
  })
})

describe('buildParamRadar', () => {
  it('drops non-numeric params and strips unit suffixes', () => {
    const axes = buildParamRadar({
      'RF Power (W)': '640',
      'Chamber Pressure (mTorr)': '20',
      'Alignment Mode': 'SMASH',
    })
    expect(axes.map(a => a.axis)).toEqual(['RF Power', 'Chamber Pressure'])
  })

  it('normalizes against the largest magnitude to 0..100', () => {
    const axes = buildParamRadar({ A: '50', B: '100', C: '25' })
    const byAxis = Object.fromEntries(axes.map(a => [a.axis, a.value]))
    expect(byAxis.B).toBe(100)
    expect(byAxis.A).toBe(50)
    expect(byAxis.C).toBe(25)
  })

  it('uses absolute magnitude (negative offsets contribute)', () => {
    const axes = buildParamRadar({ 'Focus Offset (nm)': '-50', 'Dose': '50' })
    expect(axes.every(a => a.raw >= 0)).toBe(true)
  })

  it('caps the number of axes at the limit', () => {
    const params = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`P${i}`, String(i + 1)]),
    )
    expect(buildParamRadar(params, 6)).toHaveLength(6)
  })
})
