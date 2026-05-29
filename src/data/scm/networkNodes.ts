import { mulberry32 } from '../prng'
import type { BusinessPartner } from '../erp/types'
import type { NetworkNode } from './types'

// The control-tower map is a fixed SVG viewBox of 1000 x 560. Every node x,y is
// hand-placed on a >=24px safe inset (plan Visual Design Spec A) so labels never
// clip and dots at clamp 0/1 never occlude a node. No geo/layout library —
// finite authored coords, like BayLayout's 8 fixed bays. labelSide drives the
// SVG <text> textAnchor per node so the label band never collides.
const VIEW_W = 1000
const VIEW_H = 560

// Node budget (plan A): <=5 suppliers (left column), FAB-01 (center anchor),
// 2-3 DCs (mid-right hubs), <=4 customer regions (right column). Excess vendors
// aggregate into an 'Others' supplier node; excess customers into an 'Others
// region' node. All slots below sit on the safe inset.
const SUPPLIER_SLOTS: { x: number; y: number }[] = [
  { x: 90, y: 70 },
  { x: 60, y: 175 },
  { x: 60, y: 285 },
  { x: 60, y: 395 },
  { x: 90, y: 500 },
]

const DC_SLOTS: { x: number; y: number }[] = [
  { x: 690, y: 150 },
  { x: 690, y: 410 },
  { x: 730, y: 285 },
]

const CUSTOMER_SLOTS: { x: number; y: number }[] = [
  { x: 935, y: 80 },
  { x: 940, y: 215 },
  { x: 940, y: 350 },
  { x: 935, y: 485 },
]

const FAB_SLOT = { x: 390, y: 285 }

const MAX_SUPPLIERS = 5
const MAX_CUSTOMERS = 4
const MIN_DCS = 2
const MAX_DCS = 3

const NODES_SEED = 2010

// A small DC catalog — distribution hubs FabPulse ships finished die through.
const DC_CATALOG: { name: string; region: string }[] = [
  { name: 'Hsinchu DC', region: 'TW' },
  { name: 'Singapore DC', region: 'SG' },
  { name: 'Amsterdam DC', region: 'NL' },
]

/**
 * Group customer business partners into <=4 region nodes by country, ordered by
 * descending member count (then country code for stability). Returns the region
 * key + a representative display name + member count.
 */
function groupCustomerRegions(
  customers: BusinessPartner[],
): { region: string; name: string; count: number }[] {
  const byCountry = new Map<string, number>()
  for (const c of customers) {
    byCountry.set(c.country, (byCountry.get(c.country) ?? 0) + 1)
  }
  const sorted = [...byCountry.entries()].sort((a, b) =>
    b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  return sorted.map(([region, count]) => ({
    region,
    name: `${region} Region`,
    count,
  }))
}

/**
 * Build the supply-network nodes with FIXED hand-placed x,y in the 1000x560
 * viewBox: suppliers (from ERP vendor BPs, capped at 5), FAB-01 (the anchor),
 * 2-3 distribution centers, and <=4 customer regions grouped from customer BPs.
 * Excess vendors/customers fold into an 'Others' aggregate node so the map stays
 * legible at demo scale. Deterministic via a fixed seed (DC count only).
 */
export function generateNetworkNodes(
  businessPartners: BusinessPartner[],
): NetworkNode[] {
  const rng = mulberry32(NODES_SEED)
  const nodes: NetworkNode[] = []

  const vendors = businessPartners.filter(
    bp => bp.role === 'vendor' || bp.role === 'both',
  )
  const customers = businessPartners.filter(
    bp => bp.role === 'customer' || bp.role === 'both',
  )

  // --- Suppliers (left column) ---
  // Reserve the last slot for an 'Others' aggregate when vendors overflow.
  const overflowSuppliers = vendors.length > MAX_SUPPLIERS
  const namedSupplierCount = overflowSuppliers
    ? MAX_SUPPLIERS - 1
    : Math.min(vendors.length, MAX_SUPPLIERS)

  for (let i = 0; i < namedSupplierCount; i++) {
    const vendor = vendors[i]
    const slot = SUPPLIER_SLOTS[i]
    nodes.push({
      id: `SUP-${vendor.bpNo}`,
      kind: 'supplier',
      name: vendor.name,
      region: vendor.country,
      x: slot.x,
      y: slot.y,
      labelSide: 'right',
    })
  }
  if (overflowSuppliers) {
    const slot = SUPPLIER_SLOTS[MAX_SUPPLIERS - 1]
    const extra = vendors.length - namedSupplierCount
    nodes.push({
      id: 'SUP-OTHERS',
      kind: 'supplier',
      name: `Others (+${extra})`,
      region: 'GLOBAL',
      x: slot.x,
      y: slot.y,
      labelSide: 'right',
    })
  }

  // --- FAB-01 (center anchor) ---
  nodes.push({
    id: 'FAB-01',
    kind: 'fab',
    name: 'FAB-01 Hsinchu',
    region: 'TW',
    x: FAB_SLOT.x,
    y: FAB_SLOT.y,
    labelSide: 'bottom',
  })

  // --- Distribution centers (2-3, mid-right) ---
  const dcCount = MIN_DCS + Math.floor(rng() * (MAX_DCS - MIN_DCS + 1))
  for (let i = 0; i < dcCount; i++) {
    const dc = DC_CATALOG[i]
    const slot = DC_SLOTS[i]
    nodes.push({
      id: `DC-${String(i + 1).padStart(2, '0')}`,
      kind: 'dc',
      name: dc.name,
      region: dc.region,
      x: slot.x,
      y: slot.y,
      labelSide: 'top',
    })
  }

  // --- Customer regions (right column, <=4 grouped by country) ---
  const regions = groupCustomerRegions(customers)
  const overflowCustomers = regions.length > MAX_CUSTOMERS
  const namedRegionCount = overflowCustomers
    ? MAX_CUSTOMERS - 1
    : Math.min(regions.length, MAX_CUSTOMERS)

  for (let i = 0; i < namedRegionCount; i++) {
    const region = regions[i]
    const slot = CUSTOMER_SLOTS[i]
    nodes.push({
      id: `CUS-${region.region}`,
      kind: 'customer',
      name: region.name,
      region: region.region,
      x: slot.x,
      y: slot.y,
      labelSide: 'left',
    })
  }
  if (overflowCustomers) {
    const slot = CUSTOMER_SLOTS[MAX_CUSTOMERS - 1]
    const extra = regions.length - namedRegionCount
    nodes.push({
      id: 'CUS-OTHERS',
      kind: 'customer',
      name: `Other Regions (+${extra})`,
      region: 'GLOBAL',
      x: slot.x,
      y: slot.y,
      labelSide: 'left',
    })
  }

  return nodes
}

export { VIEW_W as NETWORK_VIEW_W, VIEW_H as NETWORK_VIEW_H }
