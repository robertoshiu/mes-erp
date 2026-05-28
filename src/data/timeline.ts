import type { MesEvent } from '../lib/events'

export interface SpineBeat {
  t: number // seconds into the loop
  kind: 'framing' | 'beat'
  name: string
  events: MesEvent[]
}

/**
 * The scripted spine — 6 dramatic beats + 3 framing cues.
 * These fire at exact timestamps during each 180s loop.
 * Background events are generated separately via PRNG.
 */
export const SPINE: SpineBeat[] = [
  {
    t: 0, kind: 'framing', name: 'Shift start',
    events: [
      { topic: 'shift.boundary', t: 0, kind: 'start', shiftCode: 'A' },
    ],
  },
  {
    t: 25, kind: 'beat', name: 'Lot priority insertion',
    events: [
      { topic: 'lot.move', t: 25, lotId: 'LOT-2622W-HOT01', fromToolId: 'QUEUE', toToolId: 'EQP-LITHO-01', routeStep: 0, operatorId: 'OP-003', productCode: 'DEV-5NM-B2', customerName: 'NovaStar' },
    ],
  },
  {
    t: 50, kind: 'beat', name: 'Equipment minor alarm',
    events: [
      { topic: 'equip.state', t: 50, toolId: 'EQP-CMP-05', fromState: 'PROD', toState: 'SDT', reasonCode: 'PM_OVERDUE' },
      { topic: 'alarm.raised', t: 50, alarmId: 'ALM-0050', source: 'EQP-CMP-05', severity: 'minor', message: 'Scheduled PM overdue by 2h — pad conditioner wear', sopRef: 'SOP-CMP-003' },
    ],
  },
  {
    t: 80, kind: 'beat', name: 'Chamber drift detected',
    events: [
      { topic: 'spc.violation', t: 80, measurementId: 'MEAS-ETCH-080', ruleNumber: 2, severity: 'warn', controlPoint: { value: 52.3, ucl: 55.0, lcl: 45.0, centerline: 50.0 } },
      { topic: 'equip.state', t: 80, toolId: 'EQP-ETCH-03', fromState: 'PROD', toState: 'ENG', reasonCode: 'SPC_HOLD' },
    ],
  },
  {
    t: 105, kind: 'beat', name: 'SPC alarm escalation + engineer ack',
    events: [
      { topic: 'alarm.raised', t: 105, alarmId: 'ALM-0105', source: 'EQP-ETCH-03', severity: 'critical', message: 'Chamber drift confirmed — CD uniformity out of spec (>3sigma)', sopRef: 'SOP-ETCH-001', ackOperatorId: 'OP-012' },
      { topic: 'spc.violation', t: 105, measurementId: 'MEAS-ETCH-105', ruleNumber: 1, severity: 'critical', controlPoint: { value: 56.1, ucl: 55.0, lcl: 45.0, centerline: 50.0 } },
    ],
  },
  {
    t: 130, kind: 'beat', name: 'Recipe revision pushed',
    events: [
      { topic: 'recipe.load', t: 130, toolId: 'EQP-ETCH-03', recipeId: 'RCP-ETCH-01', recipeVersion: 'v2.3.1', approverOperatorId: 'OP-012' },
      { topic: 'equip.state', t: 130, toolId: 'EQP-ETCH-03', fromState: 'ENG', toState: 'PROD', reasonCode: 'RECIPE_UPDATED' },
    ],
  },
  {
    t: 150, kind: 'beat', name: 'KPI recovery',
    events: [
      { topic: 'kpi.tick', t: 150, oee: 0.891, yieldPct: 0.994, mtbfMinutes: 8520, mttrMinutes: 28, wipTurn: 3.4, throughputUnitsPerHour: 2450, cycleTimeMinutes: 465 },
    ],
  },
  {
    t: 175, kind: 'framing', name: 'Shift handover prep',
    events: [
      { topic: 'shift.boundary', t: 175, kind: 'handover', shiftCode: 'B' },
    ],
  },
  {
    t: 180, kind: 'framing', name: 'Loop restart',
    events: [
      { topic: 'shift.boundary', t: 180, kind: 'loop-restart', shiftCode: 'A' },
    ],
  },
]
