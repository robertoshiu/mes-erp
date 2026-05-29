import type { AppEvent, EquipStateEvent, LotMoveEvent } from './events'

export function computeOEE(availability: number, performance: number, quality: number): number {
  return Math.max(0, Math.min(1, availability * performance * quality))
}

export function computeYield(goodUnits: number, totalUnits: number): number {
  if (totalUnits === 0) return 1.0
  return goodUnits / totalUnits
}

export function computeMTBF(uptimeMinutes: number, failures: number): number {
  if (failures === 0) return Infinity
  return uptimeMinutes / failures
}

export function computeMTTR(repairMinutes: number, repairs: number): number {
  if (repairs === 0) return 0
  return repairMinutes / repairs
}

export interface KpiSnapshot {
  oee: number
  yieldPct: number
  mtbfMinutes: number
  mttrMinutes: number
  wipTurn: number
  throughputUnitsPerHour: number
  cycleTimeMinutes: number
}

// Approximate number of route steps per lot — scales per-move time to full cycle time
const AVG_PROCESS_STEPS = 25

// Baseline KPIs — used when no events have accumulated yet.
const BASELINE: KpiSnapshot = {
  oee: 0.873,
  yieldPct: 0.992,
  mtbfMinutes: 142 * 60,
  mttrMinutes: 35,
  wipTurn: 3.2,
  throughputUnitsPerHour: 2400,
  cycleTimeMinutes: 480,
}

/**
 * Compute KPI snapshot from a buffer of recent events.
 * Uses event counts and state transitions to estimate real-time KPIs.
 * Blends with baseline to avoid wild swings from small sample sizes.
 */
export function computeKpis(events: AppEvent[], totalEquipment: number): KpiSnapshot {
  if (events.length === 0) return { ...BASELINE }

  const lotMoves = events.filter((e): e is LotMoveEvent => e.topic === 'lot.move')
  const equipStates = events.filter((e): e is EquipStateEvent => e.topic === 'equip.state')

  // Time window (seconds) — events may arrive out of order
  const timestamps = events.map(e => e.t)
  const tMin = Math.min(...timestamps)
  const tMax = Math.max(...timestamps)
  const windowSec = Math.max(tMax - tMin, 1)
  const windowMin = windowSec / 60

  // Throughput: lot moves per hour
  const throughputPerHour = lotMoves.length > 0
    ? (lotMoves.length / windowSec) * 3600
    : BASELINE.throughputUnitsPerHour

  // Failures: transitions to UDT or SDT
  const failures = equipStates.filter(e => e.toState === 'UDT' || e.toState === 'SDT')
  const repairs = equipStates.filter(e => (e.fromState === 'UDT' || e.fromState === 'SDT') && e.toState === 'PROD')

  // Downtime estimation (rough: each failure assumed 3min avg until repair event)
  const downtimeMin = failures.length * 3
  const repairTimeMin = repairs.length > 0 ? downtimeMin : 0

  // Availability
  const totalUptime = totalEquipment * windowMin
  const availability = totalUptime > 0 ? Math.max(0.5, (totalUptime - downtimeMin) / totalUptime) : BASELINE.oee

  // Performance (blend with baseline)
  const perfRatio = lotMoves.length > 5
    ? Math.min(1, throughputPerHour / BASELINE.throughputUnitsPerHour)
    : 0.95

  // Quality (simulated — slight random dip on SPC violations)
  const spcViolations = events.filter(e => e.topic === 'spc.violation').length
  const quality = Math.max(0.95, 1.0 - spcViolations * 0.005)

  // Blend with baseline to avoid noisy swings
  const blendFactor = Math.min(events.length / 100, 1) // ramp up confidence
  const blend = (computed: number, baseline: number) =>
    computed * blendFactor + baseline * (1 - blendFactor)

  const oee = computeOEE(
    blend(availability, BASELINE.oee / (0.95 * BASELINE.yieldPct)),
    blend(perfRatio, 0.95),
    blend(quality, BASELINE.yieldPct),
  )

  return {
    oee: Math.max(0, Math.min(1, oee)),
    yieldPct: blend(quality, BASELINE.yieldPct),
    mtbfMinutes: failures.length > 0 ? computeMTBF(totalUptime, failures.length) : BASELINE.mtbfMinutes,
    mttrMinutes: repairs.length > 0 ? computeMTTR(repairTimeMin, repairs.length) : BASELINE.mttrMinutes,
    wipTurn: blend(lotMoves.length > 0 ? lotMoves.length / Math.max(windowMin / 60, 0.01) : BASELINE.wipTurn, BASELINE.wipTurn),
    throughputUnitsPerHour: blend(throughputPerHour, BASELINE.throughputUnitsPerHour),
    // AVG_PROCESS_STEPS: approximate number of route steps per lot, used to scale per-move time to full cycle time
    cycleTimeMinutes: blend(lotMoves.length > 0 ? windowMin / Math.max(lotMoves.length, 1) * AVG_PROCESS_STEPS : BASELINE.cycleTimeMinutes, BASELINE.cycleTimeMinutes),
  }
}
