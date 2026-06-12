// Pure computations for the Agent-A ERP master-data + logistics visual upgrade.
// Framework-free so the whole module unit-tests under the node env. Every value
// is derived deterministically from the ERP snapshot (or a cyrb53 hash) — no
// Math.random, no wall-clock — so visuals stay stable across reloads.
import { cyrb53 } from '../../data/prng'
import type {
  Material,
  MaterialType,
  Bom,
  BusinessPartner,
  InventoryRow,
  PurchaseOrder,
} from '../../data/erp/types'

/* ===========================================================================
   Materials — type distribution, ABC value classification, where-used, trend
   =========================================================================== */

export type AbcClass = 'A' | 'B' | 'C'

/** Count of materials per type, in a fixed FERT/HALB/ROH order. */
export function materialTypeCounts(materials: Material[]): Record<MaterialType, number> {
  const c: Record<MaterialType, number> = { FERT: 0, HALB: 0, ROH: 0 }
  for (const m of materials) c[m.type]++
  return c
}

/**
 * Classic ABC value analysis: rank materials by standard cost descending, then
 * cut the cumulative-cost curve at 80% (A) and 95% (B); the long tail is C.
 * Returns a stable materialNo→class map. Ties broken by materialNo so the
 * classification is deterministic regardless of input order.
 */
export function abcClassify(materials: Material[]): Map<string, AbcClass> {
  const out = new Map<string, AbcClass>()
  if (materials.length === 0) return out
  const sorted = [...materials].sort(
    (a, b) => b.standardCost - a.standardCost || a.materialNo.localeCompare(b.materialNo),
  )
  const total = sorted.reduce((s, m) => s + Math.max(0, m.standardCost), 0)
  if (total <= 0) {
    for (const m of sorted) out.set(m.materialNo, 'C')
    return out
  }
  // Class by the cumulative share *entering* each item, so the item that crosses
  // a threshold still lands in the higher class (the dominant item is always A).
  let cum = 0
  for (const m of sorted) {
    const startShare = cum / total
    out.set(m.materialNo, startShare < 0.8 ? 'A' : startShare < 0.95 ? 'B' : 'C')
    cum += Math.max(0, m.standardCost)
  }
  return out
}

/** Count of materials per ABC class, in A/B/C order. */
export function abcCounts(materials: Material[]): Record<AbcClass, number> {
  const map = abcClassify(materials)
  const c: Record<AbcClass, number> = { A: 0, B: 0, C: 0 }
  for (const cls of map.values()) c[cls]++
  return c
}

/**
 * Where-used: how many BOMs consume each material as a component. Keyed by
 * component materialNo. Materials never used as a component are simply absent
 * (callers treat a miss as 0).
 */
export function whereUsedCounts(boms: Bom[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const bom of boms) {
    // A component listed twice in one BOM still counts the parent once.
    const seen = new Set<string>()
    for (const comp of bom.components) {
      if (seen.has(comp.materialNo)) continue
      seen.add(comp.materialNo)
      out.set(comp.materialNo, (out.get(comp.materialNo) ?? 0) + 1)
    }
  }
  return out
}

/** The parent material numbers whose BOM consumes `materialNo`. */
export function whereUsedParents(boms: Bom[], materialNo: string): string[] {
  const parents: string[] = []
  for (const bom of boms) {
    if (bom.components.some(c => c.materialNo === materialNo)) parents.push(bom.headerMaterialNo)
  }
  return parents
}

/**
 * A deterministic N-point standard-cost trend for a material's drill-in: a gentle
 * hash-seeded random walk that lands exactly on the material's current standard
 * cost at the final point. cyrb53(materialNo) seeds the walk so it is identical
 * across reloads (no PRNG state, no wall-clock). Values are clamped to ≥1.
 */
export function costTrend(materialNo: string, standardCost: number, points = 12): number[] {
  const n = Math.max(2, points)
  // Per-point signed step in [-amp, +amp] derived from the hash, scaled to ~6% of cost.
  const amp = Math.max(0.5, standardCost * 0.06)
  const steps: number[] = []
  for (let i = 0; i < n; i++) {
    const h = cyrb53(materialNo, 101 + i)
    steps.push(((h % 2000) / 1000 - 1) * amp) // [-amp, +amp]
  }
  // Build a walk forward, then shift it so the last point equals standardCost.
  const raw: number[] = []
  let acc = standardCost
  for (let i = 0; i < n; i++) {
    acc += steps[i]
    raw.push(acc)
  }
  const shift = standardCost - raw[n - 1]
  return raw.map(v => Math.max(1, Math.round((v + shift) * 100) / 100))
}

/* ===========================================================================
   Business Partners — customer/vendor split, region ranks, composite scores
   =========================================================================== */

export interface RoleSplit {
  customer: number
  vendor: number
  both: number
}

export function roleSplit(partners: BusinessPartner[]): RoleSplit {
  const s: RoleSplit = { customer: 0, vendor: 0, both: 0 }
  for (const p of partners) {
    if (p.role === 'customer') s.customer++
    else if (p.role === 'vendor') s.vendor++
    else s.both++
  }
  return s
}

/** Partner count per country, sorted descending (ties by country code). */
export function regionCounts(partners: BusinessPartner[]): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const p of partners) m.set(p.country, (m.get(p.country) ?? 0) + 1)
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/**
 * Composite partner score in [0,100]: a deterministic blend of credit standing
 * (log-scaled credit limit) and a hash-seeded reliability factor (stable per BP).
 * Used to rank the top partners and fill the per-partner SparkRing.
 */
export function compositeScore(p: BusinessPartner): number {
  // Credit component: 0..70, saturating around a $2M limit (log curve).
  const credit = Math.min(70, (Math.log10(Math.max(1, p.creditLimit)) / Math.log10(2_000_000)) * 70)
  // Reliability component: 0..30, stable per BP via hash.
  const reliability = (cyrb53(p.bpNo, 53) % 301) / 10 // 0.0 .. 30.0
  return Math.round(Math.min(100, credit + reliability))
}

export interface RankedPartner {
  bpNo: string
  label: string
  value: number
  /** composite score 0..100 for the SparkRing */
  score: number
}

/** Top-N partners by composite score, descending (ties by bpNo). */
export function topPartners(partners: BusinessPartner[], n = 5): RankedPartner[] {
  return partners
    .map(p => ({ bpNo: p.bpNo, label: p.name, value: p.creditLimit, score: compositeScore(p) }))
    .sort((a, b) => b.score - a.score || a.bpNo.localeCompare(b.bpNo))
    .slice(0, n)
}

/* ===========================================================================
   Inventory — storage-location occupancy mosaic shares
   =========================================================================== */

export interface LocationOccupancy {
  loc: string
  /** Σ max(0, onHand) for the location. */
  qty: number
  /** qty / total across all locations, in [0,1]. */
  share: number
  /** number of distinct SKU rows in this location. */
  skuCount: number
}

/**
 * Aggregate on-hand quantity per storage location for the occupancy mosaic.
 * Sorted by qty descending (ties by location code) so the biggest tiles lead.
 */
export function locationOccupancy(rows: InventoryRow[]): LocationOccupancy[] {
  const byLoc = new Map<string, { qty: number; skuCount: number }>()
  for (const r of rows) {
    const e = byLoc.get(r.storageLoc) ?? { qty: 0, skuCount: 0 }
    e.qty += Math.max(0, r.onHand)
    e.skuCount += 1
    byLoc.set(r.storageLoc, e)
  }
  const total = [...byLoc.values()].reduce((s, e) => s + e.qty, 0)
  return [...byLoc.entries()]
    .map(([loc, e]) => ({
      loc,
      qty: e.qty,
      skuCount: e.skuCount,
      share: total > 0 ? e.qty / total : 0,
    }))
    .sort((a, b) => b.qty - a.qty || a.loc.localeCompare(b.loc))
}

/* ===========================================================================
   Procurement — PO pipeline stage counts, vendor on-time, delivery window
   =========================================================================== */

export interface PoPipeline {
  /** open (not yet confirmed) */
  open: number
  /** confirmed in-transit (incl. late, which is an overdue in-transit) */
  inTransit: number
  /** received */
  received: number
  /** late subset (drawn from in-transit) — kept for the .row-hot logic / pills. */
  late: number
}

/** PO counts grouped into the three pipeline stages (open → in-transit → received). */
export function poPipeline(pos: PurchaseOrder[]): PoPipeline {
  let open = 0
  let inTransit = 0
  let received = 0
  let late = 0
  for (const po of pos) {
    if (po.status === 'open') open++
    else if (po.status === 'received') received++
    else {
      // confirmed + late are both "in transit" toward receipt.
      inTransit++
      if (po.status === 'late') late++
    }
  }
  return { open, inTransit, received, late }
}

/**
 * Per-vendor on-time score in [0,100] for the RankBar: late POs drag the score
 * down, received POs lift it, with a deterministic hash jitter so vendors with
 * identical books still separate. Vendors sorted by score descending.
 */
export function vendorOnTime(pos: PurchaseOrder[]): { label: string; value: number; hint: string }[] {
  const byVendor = new Map<string, { total: number; late: number; received: number }>()
  for (const po of pos) {
    const e = byVendor.get(po.vendorName) ?? { total: 0, late: 0, received: 0 }
    e.total++
    if (po.status === 'late') e.late++
    if (po.status === 'received') e.received++
    byVendor.set(po.vendorName, e)
  }
  return [...byVendor.entries()]
    .map(([label, e]) => {
      const base = e.total > 0 ? (1 - e.late / e.total) * 100 : 100
      // small stable jitter (±2) keyed on the vendor name to break ties.
      const jitter = (cyrb53(label, 17) % 5) - 2
      const value = Math.max(0, Math.min(100, Math.round(base + jitter)))
      return { label, value, hint: `${e.total} PO` }
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/**
 * Delivery-window pressure for a PO's Heatbar cell, in [0,1]: how "tight" the gap
 * between order and delivery date is, relative to the longest window in the book.
 * Late POs read as max pressure (1). Deterministic — only date arithmetic.
 */
export function deliveryWindowDays(po: PurchaseOrder): number {
  const d = daysBetween(po.orderDate, po.deliveryDate)
  return Number.isFinite(d) ? Math.max(0, d) : 0
}

/** Whole days between two 'YYYY-MM-DD' strings (UTC, wall-clock independent). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoUtc(fromIso)
  const b = parseIsoUtc(toIso)
  if (a === null || b === null) return NaN
  return Math.round((b - a) / 86_400_000)
}

function parseIsoUtc(iso: string): number | null {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null
  const [y, m, d] = parts
  return Date.UTC(y, m - 1, d)
}
