import { describe, it, expect } from 'vitest'
import { leadScore, compositeScore, radarAxes, podium } from './scorecardViz'
import type { SupplierScorecard } from '../../data/scm/types'

function card(over: Partial<SupplierScorecard> & { bpNo: string }): SupplierScorecard {
  return {
    bpNo: over.bpNo,
    name: over.name ?? over.bpNo,
    onTimePct: over.onTimePct ?? 90,
    qualityPct: over.qualityPct ?? 90,
    avgLeadDays: over.avgLeadDays ?? 14,
    openAsns: over.openAsns ?? 0,
  }
}

describe('leadScore', () => {
  it('maps the short-lead floor to ~100 and the ceiling to 0', () => {
    expect(leadScore(2)).toBeCloseTo(100)
    expect(leadScore(45)).toBeCloseTo(0)
  })

  it('clamps beyond the bounds', () => {
    expect(leadScore(1)).toBeCloseTo(100)
    expect(leadScore(60)).toBeCloseTo(0)
  })

  it('is monotonic — a longer lead scores lower', () => {
    expect(leadScore(10)).toBeGreaterThan(leadScore(20))
  })
})

describe('compositeScore', () => {
  it('equal-weights the three normalized axes', () => {
    // on-time 90, quality 90, lead 2d → lead score 100 → mean (90+90+100)/3 = 93.3
    expect(compositeScore(card({ bpNo: 'A', onTimePct: 90, qualityPct: 90, avgLeadDays: 2 }))).toBeCloseTo(93.3, 1)
  })

  it('rounds to one decimal', () => {
    const v = compositeScore(card({ bpNo: 'A', onTimePct: 100, qualityPct: 100, avgLeadDays: 2 }))
    expect(v).toBe(100)
  })
})

describe('radarAxes', () => {
  it('returns three normalized 0..100 axes', () => {
    const axes = radarAxes(card({ bpNo: 'A', onTimePct: 95, qualityPct: 88, avgLeadDays: 2 }))
    expect(axes.map(a => a.axis)).toEqual(['On-Time', 'Quality', 'Lead'])
    expect(axes[0].value).toBe(95)
    expect(axes[1].value).toBe(88)
    expect(axes[2].value).toBe(100)
  })
})

describe('podium', () => {
  it('returns the top-N by composite score, descending', () => {
    const top = podium([
      card({ bpNo: 'LOW', onTimePct: 60, qualityPct: 60, avgLeadDays: 40 }),
      card({ bpNo: 'HIGH', onTimePct: 99, qualityPct: 99, avgLeadDays: 2 }),
      card({ bpNo: 'MID', onTimePct: 85, qualityPct: 85, avgLeadDays: 14 }),
    ])
    expect(top.map(p => p.bpNo)).toEqual(['HIGH', 'MID', 'LOW'])
  })

  it('caps at n and is pure', () => {
    const cards = [card({ bpNo: 'A' }), card({ bpNo: 'B' }), card({ bpNo: 'C' }), card({ bpNo: 'D' })]
    const before = cards.map(c => c.bpNo)
    expect(podium(cards, 2)).toHaveLength(2)
    expect(cards.map(c => c.bpNo)).toEqual(before)
  })
})
