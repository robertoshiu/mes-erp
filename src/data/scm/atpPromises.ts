import { mulberry32 } from '../prng'
import type { SalesOrder } from '../erp/types'
import type { AtpPromise } from './types'

const ATP_SEED = 2060

/**
 * Deterministically format a 'YYYY-MM-DD' date from a day offset. Mirrors the
 * ERP order generators — never reads the system clock; months clamp to 28 days.
 */
function dateFromOffset(dayOffset: number): string {
  const monthIndex = 4 + Math.floor(dayOffset / 28) // May = month index 4
  const year = 2026 + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const day = (((dayOffset % 28) + 28) % 28) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Build ATP (available-to-promise) records from open / in-process sales orders:
 * one promise per live order's first line, with a deterministic promised date
 * and an available quantity that sometimes falls short of the ordered qty (so
 * the ATP panel can surface a shortfall). Deterministic via a fixed seed.
 */
export function generateAtpPromises(salesOrders: SalesOrder[]): AtpPromise[] {
  const rng = mulberry32(ATP_SEED)

  const liveSos = salesOrders.filter(
    so => so.status === 'open' || so.status === 'in-process',
  )

  const promises: AtpPromise[] = []
  for (const so of liveSos) {
    const line = so.lines[0]
    if (!line) continue

    // Available is a fraction of ordered qty: most fully covered, ~20% short.
    const coverage = rng() < 0.2 ? 0.4 + rng() * 0.4 : 1
    const available = Math.round((line.qty * coverage) / 25) * 25

    const promisedDate = dateFromOffset(7 + Math.floor(rng() * 50))

    promises.push({
      salesOrderNo: so.orderNo,
      materialNo: line.materialNo,
      promisedDate,
      available,
    })
  }

  return promises
}
