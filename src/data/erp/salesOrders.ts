import { mulberry32, pick } from '../prng'
import type { Material, BusinessPartner } from './types'
import type { SalesOrder, SalesOrderLine, OrderStatus } from './types'

/**
 * Deterministically format a 'YYYY-MM-DD' date from PRNG-derived day offsets.
 * Never reads the system clock. Months are clamped to 28 days for safety.
 */
function dateFromOffset(monthBase: number, dayOffset: number): string {
  // monthBase 0 => 2026-05, 1 => 2026-06, ...
  const monthIndex = 4 + monthBase // May = month index 4
  const year = 2026 + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const day = ((dayOffset % 28) + 28) % 28 + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Generate ~40-60 sales orders against customer business partners, each with
 * 1-3 lines referencing finished goods (FERT). netValue is the sum of line
 * qty * netPrice. Dates are deterministic 'YYYY-MM-DD' strings. Status is
 * mostly open/in-process; priority is ~5% hot, ~1% super-hot.
 */
export function generateSalesOrders(
  materials: Material[],
  businessPartners: BusinessPartner[],
  seed: number,
): SalesOrder[] {
  const rng = mulberry32(seed)

  const ferts = materials.filter(m => m.type === 'FERT')
  const customers = businessPartners.filter(
    bp => bp.role === 'customer' || bp.role === 'both',
  )
  if (ferts.length === 0 || customers.length === 0) return []

  const orders: SalesOrder[] = []
  const count = 50

  for (let i = 0; i < count; i++) {
    const customer = pick(customers, rng)
    const numLines = 1 + Math.floor(rng() * 3) // 1..3

    const lines: SalesOrderLine[] = []
    const usedMaterials = new Set<string>()
    let netValue = 0
    for (let l = 0; l < numLines; l++) {
      const fert = pick(ferts, rng)
      if (usedMaterials.has(fert.materialNo)) continue
      usedMaterials.add(fert.materialNo)
      const qty = (1 + Math.floor(rng() * 8)) * 25 // wafer lots of 25
      // Sell at a margin over standard cost.
      const netPrice = round2(fert.standardCost * (1.25 + rng() * 0.6))
      lines.push({
        lineNo: lines.length + 1,
        materialNo: fert.materialNo,
        description: fert.description,
        qty,
        netPrice,
      })
      netValue += qty * netPrice
    }

    // Status: ~45% open, ~40% in-process, ~10% complete, ~5% hold.
    const statusRoll = rng()
    const status: OrderStatus =
      statusRoll > 0.95 ? 'hold'
      : statusRoll > 0.85 ? 'complete'
      : statusRoll > 0.45 ? 'in-process'
      : 'open'

    // Priority: ~1% super-hot, ~5% hot, rest normal.
    const prioRoll = rng()
    const priority: SalesOrder['priority'] =
      prioRoll > 0.99 ? 'super-hot' : prioRoll > 0.94 ? 'hot' : 'normal'

    const orderDay = Math.floor(rng() * 28)
    const leadDays = 14 + Math.floor(rng() * 50)

    orders.push({
      orderNo: `SO-${String(100000 + i + 1)}`,
      bpNo: customer.bpNo,
      customerName: customer.name,
      orderDate: dateFromOffset(0, orderDay),
      requestedDate: dateFromOffset(Math.floor((orderDay + leadDays) / 28), orderDay + leadDays),
      status,
      priority,
      lines,
      netValue: round2(netValue),
    })
  }

  return orders
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
