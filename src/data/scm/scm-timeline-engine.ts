import { seededRng, pick } from '../prng'
import type { EventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { ScmEvent } from '../../lib/scmEvents'
import type { ScmData, Lane } from './types'

// SCM simulation engine — mirrors the ERP timeline-engine, on the SAME clock but
// with a DISTINCT seed namespace (2000) so its event stream never correlates with
// MES (0) or ERP (1000). Emits ambient SCM activity (~1/s): forecast updates,
// supplier ASNs, occasional lane disruptions (raised then later cleared), plus a
// few scripted spine beats per loop (an early port delay, a demand spike). The
// shipment lifecycle itself lives in the shipment-driver, not here.

const AMBIENT_PER_SEC = 1

const DISRUPTION_REASONS = [
  'port congestion',
  'customs hold',
  'carrier capacity',
  'weather delay',
  'equipment failure',
]

export interface ScmTimelineEngine {
  preRoll(): void
  start(): void
  stop(): void
}

export function createScmTimelineEngine(
  clock: Clock,
  eventBus: EventBus,
  scmData: ScmData,
): ScmTimelineEngine {
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let unsubBoundary: (() => void) | null = null
  let rng: () => number = seededRng(0, 2000)

  const { forecasts, scorecards, lanes } = scmData
  const materialNos = forecasts.map(f => f.materialNo)
  const bucketCount = forecasts[0]?.buckets.length ?? 6

  let ambientAccumulator = 0
  // Lanes currently flagged disrupted this loop (so we can clear them later).
  const openDisruptions: Lane[] = []
  // Spine beats fired this loop (reset on boundary).
  let didPortDelay = false
  let didDemandSpike = false

  function ambient(t: number): ScmEvent {
    const roll = rng()
    if (roll < 0.4 && materialNos.length) {
      // Forecast update for a material bucket.
      const materialNo = pick(materialNos, rng)
      return {
        topic: 'scm.forecast.updated', t,
        materialNo,
        bucket: Math.floor(rng() * bucketCount),
        qty: (1 + Math.floor(rng() * 40)) * 25,
      }
    } else if (roll < 0.78 && scorecards.length && materialNos.length) {
      // Supplier advance ship notice.
      const sc = pick(scorecards, rng)
      const materialNo = pick(materialNos, rng)
      return {
        topic: 'scm.supplier.asn', t,
        bpNo: sc.bpNo, supplierName: sc.name,
        materialNo, qty: (1 + Math.floor(rng() * 20)) * 10,
        poNo: rng() > 0.5 ? `PO-${100000 + Math.floor(rng() * 9999)}` : null,
      }
    } else if (roll < 0.9 && lanes.length && openDisruptions.length === 0) {
      // Raise a disruption on a lane (only one ambient disruption open at a time).
      const lane = pick(lanes, rng)
      openDisruptions.push(lane)
      return {
        topic: 'scm.disruption.raised', t,
        laneId: lane.id, fromNode: lane.from, toNode: lane.to,
        reason: pick(DISRUPTION_REASONS, rng),
      }
    } else if (openDisruptions.length > 0) {
      // Clear the oldest open disruption.
      const lane = openDisruptions.shift()!
      return {
        topic: 'scm.disruption.cleared', t,
        laneId: lane.id, fromNode: lane.from, toNode: lane.to,
      }
    } else if (materialNos.length) {
      // Fallback: another forecast update keeps the feed warm.
      const materialNo = pick(materialNos, rng)
      return {
        topic: 'scm.forecast.updated', t,
        materialNo,
        bucket: Math.floor(rng() * bucketCount),
        qty: (1 + Math.floor(rng() * 40)) * 25,
      }
    } else {
      // Degenerate input (no forecasts/scorecards/lanes): emit a benign ASN-less beat.
      return {
        topic: 'scm.forecast.updated', t,
        materialNo: 'MAT-0', bucket: 0, qty: 25,
      }
    }
  }

  function fireSpine(t: number) {
    // Port-delay disruption ~20s in — a guaranteed early demo beat.
    if (!didPortDelay && t >= 20 && lanes.length) {
      didPortDelay = true
      const lane = pick(lanes, rng)
      openDisruptions.push(lane)
      eventBus.publish({
        topic: 'scm.disruption.raised', t,
        laneId: lane.id, fromNode: lane.from, toNode: lane.to,
        reason: 'port delay',
      })
    }
    // Demand spike ~40s in — a forecast surge across a few buckets.
    if (!didDemandSpike && t >= 40 && materialNos.length) {
      didDemandSpike = true
      const materialNo = pick(materialNos, rng)
      for (let b = 0; b < Math.min(3, bucketCount); b++) {
        eventBus.publish({
          topic: 'scm.forecast.updated', t,
          materialNo, bucket: b, qty: (8 + Math.floor(rng() * 8)) * 100,
        })
      }
    }
  }

  function tick() {
    const t = clock.loopT()
    fireSpine(t)

    ambientAccumulator += 0.2 // tick is 200ms
    while (ambientAccumulator >= 1 / AMBIENT_PER_SEC) {
      ambientAccumulator -= 1 / AMBIENT_PER_SEC
      eventBus.publish(ambient(t))
    }
  }

  function resetLoop(loopIndex: number) {
    rng = seededRng(loopIndex, 2000)
    ambientAccumulator = 0
    openDisruptions.length = 0
    didPortDelay = didDemandSpike = false
  }

  function preRoll() {
    // Warm the feed so SCM screens aren't empty on first paint.
    rng = seededRng(clock.loopIndex(), 2000)
    const events: ScmEvent[] = []
    for (let t = -20; t < 0; t++) {
      if (rng() < 0.8) events.push(ambient(t))
    }
    eventBus.publishBatch(events)
  }

  function start() {
    resetLoop(clock.loopIndex())
    unsubBoundary = clock.onLoopBoundary(resetLoop)
    tickInterval = setInterval(tick, 200)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (unsubBoundary) unsubBoundary()
  }

  return { preRoll, start, stop }
}
