import { mulberry32, pick, pickN } from '../prng'
import type { Material, Bom, BomComponent } from './types'

const BOM_SEED = 520

/**
 * Generate a bill of materials for every finished good (FERT). Each BOM has
 * 3-6 components drawn from the raw (ROH) and semi-finished (HALB) materials.
 *
 * To stay loosely realistic every BOM is biased to include at least one wafer
 * substrate (the base of any die) and one semi-finished WIP material, with the
 * remaining slots filled from the broader raw catalog (resists, gases, targets,
 * slurries, chemicals). Deterministic via a fixed seed.
 */
export function generateBoms(materials: Material[]): Bom[] {
  const rng = mulberry32(BOM_SEED)

  const ferts = materials.filter(m => m.type === 'FERT')
  const wafers = materials.filter(m => m.type === 'ROH' && m.materialGroup === 'SUBSTRATE')
  const semis = materials.filter(m => m.type === 'HALB')
  const otherRaw = materials.filter(
    m => m.type === 'ROH' && m.materialGroup !== 'SUBSTRATE',
  )

  const boms: Bom[] = []

  ferts.forEach((fert, i) => {
    const components: BomComponent[] = []
    const used = new Set<string>()

    const addComponent = (m: Material | undefined, qty: number) => {
      if (!m || used.has(m.materialNo)) return
      used.add(m.materialNo)
      components.push({
        materialNo: m.materialNo,
        description: m.description,
        qty,
        uom: m.baseUoM,
      })
    }

    // Always anchor on a wafer substrate (1 lot of 25 wafers per build).
    if (wafers.length > 0) addComponent(pick(wafers, rng), 25)

    // Include one semi-finished stage where available.
    if (semis.length > 0) addComponent(pick(semis, rng), 25)

    // Fill the remaining 1-4 slots from the broader raw catalog.
    const remaining = 1 + Math.floor(rng() * 4) // 1..4
    const picks = pickN(otherRaw, Math.min(remaining, otherRaw.length), rng)
    for (const p of picks) {
      const qty =
        p.baseUoM === 'L' ? round1(0.5 + rng() * 4)
        : p.baseUoM === 'KG' ? round1(0.2 + rng() * 3)
        : 1 + Math.floor(rng() * 3)
      addComponent(p, qty)
    }

    boms.push({
      bomId: `BOM-${String(i + 1).padStart(4, '0')}`,
      headerMaterialNo: fert.materialNo,
      headerDescription: fert.description,
      components,
    })
  })

  return boms
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
