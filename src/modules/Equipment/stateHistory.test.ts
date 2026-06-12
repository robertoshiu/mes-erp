import { describe, it, expect } from 'vitest'
import { buildStateHistory, uptimeShare } from './stateHistory'

describe('buildStateHistory', () => {
  it('returns the requested number of segments', () => {
    expect(buildStateHistory('EQP-LITHO-01', 'PROD', 14)).toHaveLength(14)
  })

  it('segments sum to 1 (normalized band)', () => {
    const band = buildStateHistory('EQP-ETCH-03', 'STBY', 12)
    const sum = band.reduce((s, seg) => s + seg.frac, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('pins the last segment to the live state', () => {
    const band = buildStateHistory('EQP-CMP-02', 'UDT', 10)
    expect(band[band.length - 1].state).toBe('UDT')
  })

  it('is deterministic for the same toolId + state', () => {
    const a = buildStateHistory('EQP-PVD-04', 'PROD', 14)
    const b = buildStateHistory('EQP-PVD-04', 'PROD', 14)
    expect(a).toEqual(b)
  })

  it('differs across tool ids', () => {
    const a = buildStateHistory('EQP-LITHO-01', 'PROD', 14)
    const b = buildStateHistory('EQP-LITHO-02', 'PROD', 14)
    expect(a).not.toEqual(b)
  })
})

describe('uptimeShare', () => {
  it('is the summed PROD fraction', () => {
    const share = uptimeShare([
      { state: 'PROD', frac: 0.5 },
      { state: 'STBY', frac: 0.3 },
      { state: 'PROD', frac: 0.2 },
    ])
    expect(share).toBeCloseTo(0.7)
  })
})
