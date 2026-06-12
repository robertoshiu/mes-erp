// Deterministic 24h E10 state history for a tool's drill-in strip. There is no
// real per-tool history in the demo, so we synthesize a stable band hash-seeded
// off the toolId (cyrb53 idiom, mirroring SalesOrders' ATP). Pure + framework
// free so it unit-tests under node env — identical toolId + current state always
// yields the identical band across reloads (no PRNG, no wall clock).
import { cyrb53, mulberry32 } from '../../data/prng'
import type { E10State } from '../../lib/events'

export interface StateSegment {
  state: E10State
  /** Fraction of the 24h window this segment occupies (0..1). Segments sum to 1. */
  frac: number
}

// Weighted state vocabulary for the synthetic history — productive-dominant with
// occasional standby / downtime, matching the seeded roster distribution.
const HISTORY_STATES: { state: E10State; weight: number }[] = [
  { state: 'PROD', weight: 60 },
  { state: 'STBY', weight: 16 },
  { state: 'ENG', weight: 8 },
  { state: 'SDT', weight: 8 },
  { state: 'UDT', weight: 5 },
  { state: 'NSC', weight: 3 },
]

function pickWeighted(roll: number): E10State {
  const total = HISTORY_STATES.reduce((s, h) => s + h.weight, 0)
  let acc = roll * total
  for (const h of HISTORY_STATES) {
    acc -= h.weight
    if (acc <= 0) return h.state
  }
  return HISTORY_STATES[0].state
}

/**
 * Build a deterministic 24h state band for `toolId`. `currentState` anchors the
 * most-recent (right-most) segment so the strip agrees with the live dot. The
 * band has `segments` slices of varied widths.
 */
export function buildStateHistory(
  toolId: string,
  currentState: E10State,
  segments = 14,
): StateSegment[] {
  const n = Math.max(2, Math.floor(segments))
  const rng = mulberry32(cyrb53(toolId, 0xE10))
  const raw: StateSegment[] = []

  for (let i = 0; i < n; i++) {
    // Last segment is pinned to the live state for visual continuity.
    const state = i === n - 1 ? currentState : pickWeighted(rng())
    // Varied but bounded widths (0.5..1.5 weight) so the band reads organically.
    const w = 0.5 + rng()
    raw.push({ state, frac: w })
  }

  const totalW = raw.reduce((s, seg) => s + seg.frac, 0)
  return raw.map(seg => ({ state: seg.state, frac: seg.frac / totalW }))
}

/** Per-state uptime share (PROD fraction) of a synthesized band — for read-outs. */
export function uptimeShare(band: readonly StateSegment[]): number {
  return band.filter(s => s.state === 'PROD').reduce((sum, s) => sum + s.frac, 0)
}
