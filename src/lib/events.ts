export type E10State = 'PROD' | 'STBY' | 'SDT' | 'UDT' | 'NSC' | 'ENG' | 'OUT'

export type LotMoveEvent = {
  topic: 'lot.move'
  t: number
  lotId: string
  fromToolId: string
  toToolId: string
  routeStep: number
  operatorId: string
  productCode: string
  customerName: string
}

export type EquipStateEvent = {
  topic: 'equip.state'
  t: number
  toolId: string
  fromState: E10State
  toState: E10State
  reasonCode?: string
}

export type SpcViolationEvent = {
  topic: 'spc.violation'
  t: number
  measurementId: string
  ruleNumber: 1 | 2 | 4
  severity: 'info' | 'warn' | 'critical'
  controlPoint: {
    value: number
    ucl: number
    lcl: number
    centerline: number
  }
}

export type AlarmRaisedEvent = {
  topic: 'alarm.raised'
  t: number
  alarmId: string
  source: string
  severity: 'minor' | 'major' | 'critical'
  message: string
  sopRef?: string
  ackOperatorId?: string
}

export type RecipeLoadEvent = {
  topic: 'recipe.load'
  t: number
  toolId: string
  recipeId: string
  recipeVersion: string
  approverOperatorId: string
}

export type KpiTickEvent = {
  topic: 'kpi.tick'
  t: number
  oee: number
  yieldPct: number
  mtbfMinutes: number
  mttrMinutes: number
  wipTurn: number
  throughputUnitsPerHour: number
  cycleTimeMinutes: number
}

export type ShiftBoundaryEvent = {
  topic: 'shift.boundary'
  t: number
  kind: 'start' | 'handover' | 'loop-restart'
  shiftCode: 'A' | 'B' | 'C'
}

export type MesEvent =
  | LotMoveEvent
  | EquipStateEvent
  | SpcViolationEvent
  | AlarmRaisedEvent
  | RecipeLoadEvent
  | KpiTickEvent
  | ShiftBoundaryEvent

export type EventTopic = MesEvent['topic']
