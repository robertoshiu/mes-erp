import { SPINE } from './timeline'
import { seededRng, pick } from './prng'
import type { EventBus } from '../lib/eventBus'
import type { Clock } from '../lib/clock'
import type { MesEvent, E10State } from '../lib/events'
import type { MasterData } from './master'
import { LOOP_DURATION_S } from '../lib/clock'

const BG_EVENTS_PER_SEC = 1

export interface TimelineEngine {
  preRoll(): void
  start(): void
  stop(): void
}

export function createTimelineEngine(
  clock: Clock,
  eventBus: EventBus,
  masterData: MasterData,
): TimelineEngine {
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let lastBeatIndex = -1
  let bgRng: () => number = seededRng(0, 0)

  const { equipment, operators, lots, recipes } = masterData
  const toolIds = equipment.map(e => e.toolId)

  function generateBackgroundEvent(t: number): MesEvent {
    const roll = bgRng()
    if (roll < 0.40) {
      // Lot move
      const lot = pick(lots, bgRng)
      const fromTool = pick(toolIds, bgRng)
      const toTool = pick(toolIds, bgRng)
      const op = pick(operators, bgRng)
      return {
        topic: 'lot.move', t,
        lotId: lot.lotId, fromToolId: fromTool, toToolId: toTool,
        routeStep: Math.floor(bgRng() * 8),
        operatorId: op.operatorId, productCode: lot.productCode, customerName: lot.customerName,
      }
    } else if (roll < 0.60) {
      // E10 state transition (minor — not alarming)
      const tool = pick(equipment, bgRng)
      const fromState = pick(['PROD', 'STBY'] as E10State[], bgRng)
      const toState = pick(['PROD', 'STBY'] as E10State[], bgRng)
      return {
        topic: 'equip.state', t,
        toolId: tool.toolId, fromState, toState,
      }
    } else if (roll < 0.75) {
      // Recipe load
      const tool = pick(equipment, bgRng)
      const recipe = pick(recipes, bgRng)
      const op = pick(operators.filter(o => o.role === 'engineer'), bgRng)
      return {
        topic: 'recipe.load', t,
        toolId: tool.toolId, recipeId: recipe.recipeId,
        recipeVersion: recipe.currentVersion,
        approverOperatorId: op.operatorId,
      }
    } else {
      // SPC measurement (routine — within limits)
      const centerline = 50
      const sigma = 1.5
      const value = centerline + (bgRng() - 0.5) * sigma * 4
      return {
        topic: 'spc.violation', t,
        measurementId: `MEAS-BG-${Math.floor(t * 100)}`,
        ruleNumber: 1,
        severity: 'info',
        controlPoint: { value, ucl: centerline + 3 * sigma, lcl: centerline - 3 * sigma, centerline },
      }
    }
  }

  function generateBackgroundEventWithRng(t: number, rng: () => number): MesEvent {
    const savedRng = bgRng
    bgRng = rng
    const event = generateBackgroundEvent(t)
    bgRng = savedRng
    return event
  }

  function generatePreRollEvents(loopIndex: number): MesEvent[] {
    const events: MesEvent[] = []
    const preRng = seededRng(loopIndex, -1)
    for (let t = -30; t < 0; t++) {
      // ~1 event per second for pre-roll
      const roll = preRng()
      if (roll < 0.8) { // 80% chance of event each second
        events.push(generateBackgroundEventWithRng(t, preRng))
      }
    }
    return events
  }

  function preRoll() {
    const events = generatePreRollEvents(0)
    eventBus.publishBatch(events)
  }

  let bgAccumulator = 0

  function tick() {
    const t = clock.loopT()

    // Fire spine beats that haven't fired yet in this loop
    for (let i = 0; i < SPINE.length; i++) {
      if (i > lastBeatIndex && SPINE[i].t <= t && SPINE[i].t < LOOP_DURATION_S) {
        lastBeatIndex = i
        for (const event of SPINE[i].events) {
          eventBus.publish({ ...event, t })
        }
      }
    }

    // Fire background events at ~1/sec
    bgAccumulator += 0.1 // tick is 100ms
    while (bgAccumulator >= 1.0 / BG_EVENTS_PER_SEC) {
      bgAccumulator -= 1.0 / BG_EVENTS_PER_SEC
      eventBus.publish(generateBackgroundEvent(t))
    }
  }

  function handleLoopBoundary(newLoopIndex: number) {
    lastBeatIndex = -1
    bgRng = seededRng(newLoopIndex, 0)
    bgAccumulator = 0
    // Pre-roll for new loop
    const events = generatePreRollEvents(newLoopIndex)
    eventBus.publishBatch(events)
  }

  let unsubLoopBoundary: (() => void) | null = null

  function start() {
    bgRng = seededRng(clock.loopIndex(), 0)
    unsubLoopBoundary = clock.onLoopBoundary(handleLoopBoundary)
    tickInterval = setInterval(tick, 100)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (unsubLoopBoundary) unsubLoopBoundary()
  }

  return { preRoll, start, stop }
}
