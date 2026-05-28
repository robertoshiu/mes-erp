import { describe, it, expect } from 'vitest'
import { computeOEE, computeYield, computeMTBF, computeMTTR, computeKpis } from './kpi'
import type { MesEvent } from './events'

describe('KPI formulas', () => {
  describe('OEE', () => {
    it('returns availability * performance * quality', () => {
      // availability = 0.9, performance = 0.85, quality = 0.99
      expect(computeOEE(0.9, 0.85, 0.99)).toBeCloseTo(0.757, 2)
    })

    it('clamps to [0, 1]', () => {
      expect(computeOEE(1.1, 1.0, 1.0)).toBeCloseTo(1.0)
      expect(computeOEE(0, 0.5, 0.5)).toBeCloseTo(0)
    })
  })

  describe('Yield', () => {
    it('returns good units / total units', () => {
      expect(computeYield(990, 1000)).toBeCloseTo(0.99, 3)
    })

    it('returns 1.0 for zero total', () => {
      expect(computeYield(0, 0)).toBe(1.0)
    })
  })

  describe('MTBF', () => {
    it('returns total uptime / number of failures', () => {
      // 1000 minutes uptime, 5 failures
      expect(computeMTBF(1000, 5)).toBeCloseTo(200)
    })

    it('returns Infinity for zero failures', () => {
      expect(computeMTBF(1000, 0)).toBe(Infinity)
    })
  })

  describe('MTTR', () => {
    it('returns total repair time / number of repairs', () => {
      expect(computeMTTR(50, 5)).toBeCloseTo(10)
    })

    it('returns 0 for zero repairs', () => {
      expect(computeMTTR(0, 0)).toBe(0)
    })
  })

  describe('computeKpis from event buffer', () => {
    it('computes KPIs from a mixed event buffer', () => {
      const events: MesEvent[] = [
        { topic: 'lot.move', t: 0, lotId: 'L1', fromToolId: 'A', toToolId: 'B', routeStep: 1, operatorId: 'OP1', productCode: 'P1', customerName: 'C1' },
        { topic: 'lot.move', t: 1, lotId: 'L2', fromToolId: 'B', toToolId: 'C', routeStep: 2, operatorId: 'OP2', productCode: 'P2', customerName: 'C2' },
        { topic: 'equip.state', t: 2, toolId: 'A', fromState: 'PROD', toState: 'UDT' },
        { topic: 'equip.state', t: 5, toolId: 'A', fromState: 'UDT', toState: 'PROD' },
        { topic: 'lot.move', t: 10, lotId: 'L3', fromToolId: 'C', toToolId: 'D', routeStep: 3, operatorId: 'OP3', productCode: 'P3', customerName: 'C3' },
      ]
      const kpis = computeKpis(events, 50) // 50 total equipment
      expect(kpis.oee).toBeGreaterThan(0)
      expect(kpis.oee).toBeLessThanOrEqual(1)
      expect(kpis.yieldPct).toBeGreaterThan(0)
      expect(kpis.throughputUnitsPerHour).toBeGreaterThan(0)
    })

    it('returns baseline KPIs for empty buffer', () => {
      const kpis = computeKpis([], 50)
      expect(kpis.oee).toBeGreaterThan(0.8) // baseline should be healthy
      expect(kpis.yieldPct).toBeGreaterThan(0.95)
    })
  })
})
