import { mulberry32, pick } from '../prng'
import type { ProcessRoute } from '../master/routes'
import type { Material, SalesOrder } from './types'
import type { ProductionOrder, ProdOrderStatus } from './types'

/**
 * Generate ~30-40 production orders for finished goods (FERT). Each order picks
 * a route whose technology matches the product (falling back to any route),
 * a target quantity, and a status spread across the lifecycle. Some orders are
 * linked to an existing sales order. lotId is left null — the runtime bridge
 * fills it when the order is dropped onto the fab floor. Deterministic.
 */
export function generateProductionOrders(
  materials: Material[],
  routes: ProcessRoute[],
  salesOrders: SalesOrder[],
  seed: number,
): ProductionOrder[] {
  const rng = mulberry32(seed)

  const ferts = materials.filter(m => m.type === 'FERT')
  if (ferts.length === 0 || routes.length === 0) return []

  // Match a route to a FERT by the technology token embedded in its productCode
  // (e.g. 'DEV-7NM-A3' -> route technology '7nm'). Fall back to any route.
  const routeFor = (mat: Material): ProcessRoute => {
    const code = (mat.productCode ?? '').toUpperCase()
    const matched = routes.filter(r => code.includes(r.technology.toUpperCase()))
    return matched.length > 0 ? pick(matched, rng) : pick(routes, rng)
  }

  const orders: ProductionOrder[] = []
  const count = 36

  for (let i = 0; i < count; i++) {
    const fert = pick(ferts, rng)
    const route = routeFor(fert)
    const targetQty = (1 + Math.floor(rng() * 8)) * 25 // wafer lots of 25

    // Status spread: ~20% Created, ~30% Released, ~35% InProcess, ~15% Completed.
    const statusRoll = rng()
    const status: ProdOrderStatus =
      statusRoll > 0.85 ? 'Completed'
      : statusRoll > 0.50 ? 'InProcess'
      : statusRoll > 0.20 ? 'Released'
      : 'Created'

    // Link ~60% of orders to a sales order.
    let salesOrderNo: string | null = null
    if (salesOrders.length > 0 && rng() < 0.6) {
      salesOrderNo = pick(salesOrders, rng).orderNo
    }

    orders.push({
      orderNo: `PRO-${String(300000 + i + 1)}`,
      materialNo: fert.materialNo,
      description: fert.description,
      routeId: route.routeId,
      targetQty,
      status,
      salesOrderNo,
      lotId: null,
    })
  }

  return orders
}
