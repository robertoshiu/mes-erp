import { mulberry32 } from '../prng'
import type { Material, Plant, InventoryRow } from './types'

/**
 * Pick the main storage location for a material based on its type:
 * ROH -> RAW, HALB -> WIP, FERT -> FG.
 */
function storageLocFor(material: Material, plant: Plant): string {
  const preferred =
    material.type === 'ROH' ? 'RAW'
    : material.type === 'HALB' ? 'WIP'
    : 'FG'
  return plant.storageLocations.includes(preferred)
    ? preferred
    : plant.storageLocations[0]
}

/**
 * Generate one inventory row per material at its main storage location in the
 * primary plant (FAB-01). available = onHand - committed, never negative.
 * ~8-12% of materials are deliberately short (available below a small
 * threshold) so the MRP board surfaces shortages. Deterministic.
 */
export function generateInventory(
  materials: Material[],
  plants: Plant[],
  seed: number,
): InventoryRow[] {
  const rng = mulberry32(seed)
  const plant = plants.find(p => p.plantId === 'FAB-01') ?? plants[0]
  if (!plant) return []

  const rows: InventoryRow[] = []

  for (const material of materials) {
    const storageLoc = storageLocFor(material, plant)

    // ~10% of materials are short on stock.
    const isShort = rng() < 0.1

    let onHand: number
    let committed: number
    if (isShort) {
      // Committed meets or exceeds on-hand -> little/no available stock.
      onHand = Math.floor(rng() * 20)
      committed = onHand + Math.floor(rng() * 30) // demand outstrips supply
    } else {
      const base = material.type === 'ROH' ? 200 : material.type === 'HALB' ? 80 : 120
      onHand = base + Math.floor(rng() * base * 3)
      committed = Math.floor(rng() * onHand * 0.6)
    }

    const available = Math.max(0, onHand - committed)

    rows.push({
      materialNo: material.materialNo,
      description: material.description,
      plant: plant.plantId,
      storageLoc,
      onHand,
      committed,
      available,
    })
  }

  return rows
}
