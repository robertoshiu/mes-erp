import { mulberry32 } from '../prng'
import type { BusinessPartner } from '../erp/types'
import type { SupplierScorecard } from './types'

const SCORECARD_SEED = 2050

// Cap the scorecard set to the same supplier budget the map uses (plan A: <=5
// named suppliers) so the card grid stays legible; the rest are out of frame.
const MAX_SCORECARDS = 5

/**
 * Build supplier scorecards from the ERP vendor business partners: on-time %,
 * quality %, average lead days, and open ASN count. Values are seeded per vendor
 * (skewed high so most read healthy, a few dip into amber/rose for the at-risk
 * drill-in). Deterministic via a per-vendor seeded PRNG.
 */
export function generateScorecards(
  businessPartners: BusinessPartner[],
): SupplierScorecard[] {
  const vendors = businessPartners
    .filter(bp => bp.role === 'vendor' || bp.role === 'both')
    .slice(0, MAX_SCORECARDS)

  return vendors.map((vendor, idx) => {
    const rng = mulberry32(SCORECARD_SEED + idx * 11)

    // On-time / quality skew high (80..99); a seeded dip pulls a few below 90.
    const onTimePct = round1(80 + rng() * 19)
    const qualityPct = round1(88 + rng() * 11)
    const avgLeadDays = round1(5 + rng() * 30)
    const openAsns = Math.floor(rng() * 6)

    return {
      bpNo: vendor.bpNo,
      name: vendor.name,
      onTimePct,
      qualityPct,
      avgLeadDays,
      openAsns,
    }
  })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
