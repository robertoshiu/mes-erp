// Recursive BOM cost roll-up. Pure + deterministic over the ERP master data —
// no random, no wall-clock — so it unit-tests cleanly under the node env.

import type { Bom, Material } from '../../data/erp/types'

/** Per-component extended cost line for the drill-in roll-up viz. */
export interface ComponentCost {
  materialNo: string
  description: string
  qty: number
  uom: string
  /** Rolled-up unit cost for one of this component (own std cost, or its own
   *  BOM roll-up when the component is itself a manufactured material). */
  unitCost: number
  /** unitCost × qty — this component's contribution to the parent. */
  extended: number
}

export interface BomRollup {
  /** Total rolled-up cost of one header assembly. */
  total: number
  components: ComponentCost[]
}

/**
 * Roll up the cost of a BOM header from its components. A component's unit cost
 * is its own BOM roll-up if it has one (a sub-assembly), else its material
 * master standard cost. Recursion is guarded against cycles via a visited set so
 * a self-referential or circular BOM can never infinite-loop.
 */
export function rollupBomCost(
  bom: Bom,
  bomByHeader: Map<string, Bom>,
  matByNo: Map<string, Material>,
  visited: ReadonlySet<string> = new Set(),
): BomRollup {
  const guard = new Set(visited)
  guard.add(bom.headerMaterialNo)

  const components: ComponentCost[] = bom.components.map(c => {
    const subBom = bomByHeader.get(c.materialNo)
    let unitCost: number
    if (subBom && !guard.has(c.materialNo)) {
      // Manufactured sub-assembly — recurse.
      unitCost = rollupBomCost(subBom, bomByHeader, matByNo, guard).total
    } else {
      // Purchased / raw (or cycle guard hit) — fall back to std cost.
      unitCost = matByNo.get(c.materialNo)?.standardCost ?? 0
    }
    const extended = unitCost * c.qty
    return {
      materialNo: c.materialNo,
      description: c.description,
      qty: c.qty,
      uom: c.uom,
      unitCost,
      extended,
    }
  })

  const total = components.reduce((s, c) => s + c.extended, 0)
  return { total, components }
}

/** Convenience: build the header-material → Bom index used by the roll-up. */
export function indexBomsByHeader(boms: Bom[]): Map<string, Bom> {
  const m = new Map<string, Bom>()
  for (const b of boms) {
    // First definition wins — keep it deterministic for duplicate headers.
    if (!m.has(b.headerMaterialNo)) m.set(b.headerMaterialNo, b)
  }
  return m
}
