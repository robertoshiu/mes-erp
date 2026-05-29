import { mulberry32 } from '../prng'
import type { NetworkNode, Lane, LaneMode } from './types'

const LANES_SEED = 2020

// Transit-day bands per mode (slow sea -> fast air). transitDays is deterministic
// within the band; the runtime driver converts a shipment's transitDays into
// loop seconds. Lane mode also drives the map stroke TEXTURE (plan B), not color.
const TRANSIT_BANDS: Record<LaneMode, { lo: number; hi: number }> = {
  air: { lo: 2, hi: 5 },
  sea: { lo: 18, hi: 35 },
  truck: { lo: 1, hi: 4 },
}

/**
 * Choose a lane mode from the geographic relationship of the two nodes:
 *  - same region (e.g. TW domestic, or a DC in TW) -> truck,
 *  - overseas (different region) -> air for upstream supply (speed-sensitive
 *    inbound), sea for the bulkier downstream distribution leg.
 */
function modeFor(from: NetworkNode, to: NetworkNode): LaneMode {
  if (from.region === to.region) return 'truck'
  // Inbound supply legs favor air; distribution legs favor sea.
  if (from.kind === 'supplier') return 'air'
  return 'sea'
}

/**
 * Build the directed lanes that wire the network: every supplier -> FAB-01,
 * FAB-01 -> every DC, and every DC -> every customer region. Mode is derived
 * from geography; transitDays is deterministic per mode band. If FAB-01 is
 * missing (degenerate input) no lanes are produced. Deterministic via a fixed seed.
 */
export function generateLanes(nodes: NetworkNode[]): Lane[] {
  const rng = mulberry32(LANES_SEED)
  const lanes: Lane[] = []

  const fab = nodes.find(n => n.kind === 'fab')
  if (!fab) return lanes

  const suppliers = nodes.filter(n => n.kind === 'supplier')
  const dcs = nodes.filter(n => n.kind === 'dc')
  const customers = nodes.filter(n => n.kind === 'customer')

  function transitFor(mode: LaneMode): number {
    const band = TRANSIT_BANDS[mode]
    return band.lo + Math.floor(rng() * (band.hi - band.lo + 1))
  }

  function addLane(from: NetworkNode, to: NetworkNode): void {
    const mode = modeFor(from, to)
    lanes.push({
      id: `LN-${from.id}->${to.id}`,
      from: from.id,
      to: to.id,
      mode,
      transitDays: transitFor(mode),
    })
  }

  // Inbound supply legs.
  for (const supplier of suppliers) addLane(supplier, fab)
  // FAB -> distribution hubs.
  for (const dc of dcs) addLane(fab, dc)
  // Distribution -> customer regions.
  for (const dc of dcs) {
    for (const customer of customers) addLane(dc, customer)
  }

  return lanes
}
