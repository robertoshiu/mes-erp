import { describe, it, expect } from 'vitest'
import { foldWipByStep, wipPeak } from './wipFold'

type Lot = Parameters<typeof foldWipByStep>[0][number]

function lot(lotId: string, currentStep: number, status: Lot['status'] = 'in-process'): Lot {
  return { lotId, currentStep, totalSteps: 8, status }
}

describe('foldWipByStep', () => {
  it('produces a fixed-width histogram regardless of occupancy', () => {
    const out = foldWipByStep([lot('A', 0), lot('B', 0)], {}, 5)
    expect(out).toHaveLength(5)
    expect(out.map(b => b.step)).toEqual([0, 1, 2, 3, 4])
    expect(out[0].count).toBe(2)
    expect(out[1].count).toBe(0)
  })

  it('uses the live step override over the seeded currentStep', () => {
    const out = foldWipByStep([lot('A', 0)], { A: 3 }, 5)
    expect(out[0].count).toBe(0)
    expect(out[3].count).toBe(1)
  })

  it('excludes completed lots from WIP', () => {
    const out = foldWipByStep([lot('A', 1), lot('B', 1, 'complete')], {}, 4)
    expect(out[1].count).toBe(1)
  })

  it('clamps steps beyond the window into the last bucket (no lot lost)', () => {
    const out = foldWipByStep([lot('A', 9)], {}, 4)
    const total = out.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(1)
    expect(out[3].count).toBe(1)
  })

  it('ignores non-finite overrides', () => {
    const out = foldWipByStep([lot('A', 2)], { A: Number.NaN }, 4)
    // NaN override is non-finite -> the lot is skipped entirely.
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(0)
  })
})

describe('wipPeak', () => {
  it('returns the largest bucket count', () => {
    expect(wipPeak([{ step: 0, count: 2 }, { step: 1, count: 5 }])).toBe(5)
  })

  it('floors at 1 for an all-empty histogram', () => {
    expect(wipPeak([{ step: 0, count: 0 }])).toBe(1)
  })
})
