import type { MasterData } from '../master'
import type { CostCenter } from './types'

// Human-readable area name per process tool type.
const AREA_NAMES: Record<string, string> = {
  LITHO: 'Lithography',
  ETCH: 'Etch',
  CMP: 'Chemical Mechanical Planarization',
  CVD: 'Chemical Vapor Deposition',
  PVD: 'Physical Vapor Deposition',
  DIFF: 'Diffusion & Furnace',
  IMPL: 'Ion Implant',
  INSP: 'Metrology & Inspection',
}

/**
 * Generate one cost center per distinct process area (tool type) seen in the
 * equipment master, plus a couple of overhead cost centers. Deterministic:
 * derived purely from the (already deterministic) equipment list.
 */
export function generateCostCenters(masterData: MasterData): CostCenter[] {
  const plant = 'FAB-01'
  const costCenters: CostCenter[] = []

  // Distinct tool types in stable (first-seen) order.
  const seen = new Set<string>()
  for (const eq of masterData.equipment) {
    if (seen.has(eq.toolType)) continue
    seen.add(eq.toolType)
    costCenters.push({
      costCenterId: `CC-${eq.toolType}`,
      name: AREA_NAMES[eq.toolType] ?? eq.toolType,
      area: eq.toolType,
      plant,
    })
  }

  // Overhead / shared cost centers.
  costCenters.push(
    { costCenterId: 'CC-FAC', name: 'Facilities & Utilities', area: 'FACILITY', plant },
    { costCenterId: 'CC-OVH', name: 'Fab Overhead', area: 'OVERHEAD', plant },
  )

  return costCenters
}
