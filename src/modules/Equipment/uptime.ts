// Deterministic synthetic uptime % per tool. The demo roster has no real OEE/
// uptime metric, so we derive a stable percentage hash-seeded off toolId (cyrb53
// idiom) and modulated by the live E10 state — productive tools read high, down
// tools read low — so the RankBar + Heatbar cells agree with the state column.
// Pure + framework-free: unit-tests under node env, no PRNG-in-render, no clock.
import { cyrb53 } from '../../data/prng'
import type { E10State } from '../../lib/events'

// State ceiling/floor band the synthetic uptime is mapped into (percent points).
const STATE_BAND: Record<E10State, [number, number]> = {
  PROD: [88, 99],
  STBY: [72, 88],
  ENG: [60, 80],
  SDT: [40, 65],
  UDT: [10, 45],
  NSC: [50, 75],
  OUT: [0, 20],
}

/**
 * Synthetic uptime percentage (0..100) for a tool given its live E10 state.
 * Deterministic: cyrb53(toolId) selects a stable point inside the state's band.
 */
export function syntheticUptime(toolId: string, state: E10State): number {
  const [lo, hi] = STATE_BAND[state] ?? STATE_BAND.NSC
  const roll = (cyrb53(toolId, 0x0EE) % 1000) / 1000
  return Math.round((lo + roll * (hi - lo)) * 10) / 10
}

export interface ToolUptime {
  toolId: string
  uptime: number
}

/** Rank tools by synthetic uptime (descending). Stable + pure. */
export function rankByUptime(
  tools: readonly { toolId: string }[],
  states: Record<string, E10State>,
): ToolUptime[] {
  return tools
    .map(t => ({ toolId: t.toolId, uptime: syntheticUptime(t.toolId, states[t.toolId] ?? 'NSC') }))
    .sort((a, b) => b.uptime - a.uptime)
}
