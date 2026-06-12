import { describe, it, expect } from 'vitest'
import { coverageIntensity, buildMatrix, shortageProjection } from './mrpMatrix'
import type { CoverageRow } from '../../data/erp/coverage'

/** Minimal CoverageRow factory for the matrix tests. */
function row(over: Partial<CoverageRow> & { materialNo: string }): CoverageRow {
  return {
    materialNo: over.materialNo,
    description: over.description ?? over.materialNo,
    plant: '1000',
    storageLoc: '0001',
    baseUoM: 'EA',
    leadTimeDays: 3,
    onHand: over.onHand ?? 100,
    committed: over.committed ?? 0,
    available: over.available ?? 100,
    burn: over.burn ?? 10,
    projected: over.projected ?? [90, 80, 70, 60, 50],
    shortage: over.shortage ?? false,
    firstBreach: over.firstBreach ?? -1,
  }
}

describe('coverageIntensity', () => {
  it('floors a breach (projected ≤ 0) to 0', () => {
    expect(coverageIntensity(0, 10)).toBe(0)
    expect(coverageIntensity(-25, 10)).toBe(0)
  })

  it('treats any positive stock as fully covered when burn is 0', () => {
    expect(coverageIntensity(5, 0)).toBe(1)
    expect(coverageIntensity(1000, 0)).toBe(1)
  })

  it('saturates to 1 at ≥2 buckets of cover', () => {
    expect(coverageIntensity(20, 10)).toBe(1) // exactly 2 buckets
    expect(coverageIntensity(60, 10)).toBe(1) // 6 buckets
  })

  it('scales linearly between 0 and 2 buckets of cover', () => {
    expect(coverageIntensity(10, 10)).toBeCloseTo(0.5) // 1 bucket → 0.5
    expect(coverageIntensity(5, 10)).toBeCloseTo(0.25) // half a bucket → 0.25
  })
})

describe('buildMatrix', () => {
  it('sorts shortage rows ahead of covered rows', () => {
    const cov = [
      row({ materialNo: 'COVERED', shortage: false }),
      row({ materialNo: 'SHORT', shortage: true, firstBreach: 2, projected: [50, 20, -5, -20, -35] }),
    ]
    const m = buildMatrix(cov)
    expect(m[0].materialNo).toBe('SHORT')
    expect(m[1].materialNo).toBe('COVERED')
  })

  it('orders shortages by earliest breach first', () => {
    const cov = [
      row({ materialNo: 'LATE', shortage: true, firstBreach: 4, projected: [40, 30, 20, 10, -5] }),
      row({ materialNo: 'EARLY', shortage: true, firstBreach: 1, projected: [10, -5, -20, -35, -50] }),
    ]
    const m = buildMatrix(cov)
    expect(m[0].materialNo).toBe('EARLY')
    expect(m[1].materialNo).toBe('LATE')
  })

  it('caps the result at topN', () => {
    const cov = Array.from({ length: 20 }, (_, i) => row({ materialNo: `M${i}` }))
    expect(buildMatrix(cov, 12)).toHaveLength(12)
    expect(buildMatrix(cov, 5)).toHaveLength(5)
  })

  it('marks breached cells and computes per-cell intensity', () => {
    const cov = [row({ materialNo: 'X', burn: 10, projected: [20, 10, 0, -10, -20], shortage: true, firstBreach: 2 })]
    const cells = buildMatrix(cov)[0].cells
    expect(cells.map(c => c.breach)).toEqual([false, false, true, true, true])
    expect(cells[0].intensity).toBe(1) // 2 buckets cover
    expect(cells[1].intensity).toBeCloseTo(0.5)
    expect(cells[2].intensity).toBe(0)
  })

  it('is pure — does not mutate the input array', () => {
    const cov = [row({ materialNo: 'B' }), row({ materialNo: 'A' })]
    const before = cov.map(r => r.materialNo)
    buildMatrix(cov)
    expect(cov.map(r => r.materialNo)).toEqual(before)
  })
})

describe('shortageProjection', () => {
  it('sums per-bucket deficits across all materials', () => {
    const cov = [
      row({ materialNo: 'A', projected: [10, -5, -10, -15, -20] }),
      row({ materialNo: 'B', projected: [-2, -3, 5, -1, -4] }),
    ]
    const pts = shortageProjection(cov, ['B1', 'B2', 'B3', 'B4', 'B5'])
    expect(pts.map(p => p.shortfall)).toEqual([2, 8, 10, 16, 24])
    expect(pts.map(p => p.bucket)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5'])
  })

  it('returns all-zero shortfall when nothing breaches', () => {
    const cov = [row({ materialNo: 'A', projected: [90, 80, 70, 60, 50] })]
    const pts = shortageProjection(cov, ['B1', 'B2', 'B3', 'B4', 'B5'])
    expect(pts.every(p => p.shortfall === 0)).toBe(true)
  })
})
