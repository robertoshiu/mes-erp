import { describe, it, expect } from 'vitest'
import { syntheticUptime, rankByUptime } from './uptime'

describe('syntheticUptime', () => {
  it('is deterministic for the same tool + state', () => {
    expect(syntheticUptime('EQP-LITHO-01', 'PROD')).toBe(syntheticUptime('EQP-LITHO-01', 'PROD'))
  })

  it('keeps productive tools high and down tools low', () => {
    const prod = syntheticUptime('EQP-LITHO-01', 'PROD')
    const down = syntheticUptime('EQP-LITHO-01', 'UDT')
    expect(prod).toBeGreaterThan(down)
    expect(prod).toBeGreaterThanOrEqual(88)
    expect(down).toBeLessThanOrEqual(45)
  })

  it('stays within 0..100', () => {
    for (const s of ['PROD', 'STBY', 'ENG', 'SDT', 'UDT', 'NSC', 'OUT'] as const) {
      const u = syntheticUptime('EQP-CMP-02', s)
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(100)
    }
  })
})

describe('rankByUptime', () => {
  it('sorts tools by uptime descending', () => {
    const ranked = rankByUptime(
      [{ toolId: 'A' }, { toolId: 'B' }, { toolId: 'C' }],
      { A: 'UDT', B: 'PROD', C: 'STBY' },
    )
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].uptime).toBeGreaterThanOrEqual(ranked[i].uptime)
    }
    // B (PROD) should outrank A (UDT).
    expect(ranked[0].toolId).toBe('B')
  })

  it('defaults a missing state to NSC', () => {
    const ranked = rankByUptime([{ toolId: 'X' }], {})
    expect(ranked[0].uptime).toBe(syntheticUptime('X', 'NSC'))
  })
})
