import { mulberry32 } from '../prng'
import type { MasterData } from '../master'
import type { WorkCenter, CostCenter } from './types'

const WC_SEED = 530

/**
 * Generate one work center per equipment tool. Each maps to its tool type and
 * bay, and is assigned the cost center for its process area (CC-<toolType>),
 * falling back to overhead if no matching cost center exists. Deterministic.
 */
export function generateWorkCenters(
  masterData: MasterData,
  costCenters: CostCenter[],
): WorkCenter[] {
  const rng = mulberry32(WC_SEED)

  const ccByArea = new Map<string, CostCenter>()
  for (const cc of costCenters) ccByArea.set(cc.area, cc)
  const fallback = costCenters.find(cc => cc.area === 'OVERHEAD') ?? costCenters[0]

  return masterData.equipment.map(eq => {
    const cc = ccByArea.get(eq.toolType) ?? fallback
    // Tools run ~24h/day; vary effective capacity 18-23h for downtime/PM.
    const capacityHrs = 18 + Math.floor(rng() * 6)
    return {
      workCenterId: `WC-${eq.toolId.replace(/^EQP-/, '')}`,
      name: eq.toolName,
      toolType: eq.toolType,
      costCenterId: cc.costCenterId,
      bay: eq.bay,
      capacityHrs,
    }
  })
}
