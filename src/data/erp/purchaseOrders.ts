import { mulberry32, pick } from '../prng'
import type { Material, BusinessPartner } from './types'
import type { PurchaseOrder, PurchaseOrderLine } from './types'

/**
 * Deterministically format a 'YYYY-MM-DD' date from PRNG-derived day offsets.
 * Never reads the system clock. Months are clamped to 28 days for safety.
 */
function dateFromOffset(monthBase: number, dayOffset: number): string {
  const monthIndex = 4 + monthBase // May = month index 4
  const year = 2026 + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const day = ((dayOffset % 28) + 28) % 28 + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Generate ~30-40 purchase orders to vendor business partners for raw (ROH)
 * materials. Each PO has 1-3 lines. Status is mostly open/confirmed with a few
 * late. deliveryDate is a deterministic 'YYYY-MM-DD' string after orderDate.
 */
export function generatePurchaseOrders(
  materials: Material[],
  businessPartners: BusinessPartner[],
  seed: number,
): PurchaseOrder[] {
  const rng = mulberry32(seed)

  const raws = materials.filter(m => m.type === 'ROH')
  const vendors = businessPartners.filter(
    bp => bp.role === 'vendor' || bp.role === 'both',
  )
  if (raws.length === 0 || vendors.length === 0) return []

  const orders: PurchaseOrder[] = []
  const count = 35

  for (let i = 0; i < count; i++) {
    const vendor = pick(vendors, rng)
    const numLines = 1 + Math.floor(rng() * 3) // 1..3

    const lines: PurchaseOrderLine[] = []
    const usedMaterials = new Set<string>()
    let netValue = 0
    for (let l = 0; l < numLines; l++) {
      const mat = pick(raws, rng)
      if (usedMaterials.has(mat.materialNo)) continue
      usedMaterials.add(mat.materialNo)
      const qty =
        mat.baseUoM === 'WAF' ? (1 + Math.floor(rng() * 8)) * 25
        : mat.baseUoM === 'EA' ? 1 + Math.floor(rng() * 10)
        : round1((1 + Math.floor(rng() * 50)) * 1.0) // L / KG
      // Buy near standard cost.
      const netPrice = round2(mat.standardCost * (0.9 + rng() * 0.25))
      lines.push({
        lineNo: lines.length + 1,
        materialNo: mat.materialNo,
        description: mat.description,
        qty,
        netPrice,
      })
      netValue += qty * netPrice
    }

    // Status: ~45% open, ~35% confirmed, ~12% late, ~8% received.
    const statusRoll = rng()
    const status: PurchaseOrder['status'] =
      statusRoll > 0.92 ? 'received'
      : statusRoll > 0.80 ? 'late'
      : statusRoll > 0.45 ? 'confirmed'
      : 'open'

    const orderDay = Math.floor(rng() * 28)
    const leadDays = 7 + Math.floor(rng() * 45)

    orders.push({
      poNo: `PO-${String(200000 + i + 1)}`,
      bpNo: vendor.bpNo,
      vendorName: vendor.name,
      orderDate: dateFromOffset(0, orderDay),
      deliveryDate: dateFromOffset(Math.floor((orderDay + leadDays) / 28), orderDay + leadDays),
      status,
      lines,
      netValue: round2(netValue),
    })
  }

  return orders
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
