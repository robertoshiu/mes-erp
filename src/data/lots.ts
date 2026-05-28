import { mulberry32, pick } from './prng'
import type { Product } from './master/products'
import type { Customer } from './master/customers'
import type { ProcessRoute } from './master/routes'

export interface Lot {
  lotId: string
  productCode: string
  customerName: string
  routeId: string
  currentStep: number
  totalSteps: number
  waferCount: number
  priority: 'normal' | 'hot' | 'super-hot'
  status: 'in-process' | 'hold' | 'complete' | 'queued'
  currentToolId: string | null
  startTime: string
  parentLotId: string | null
  childLotIds: string[]
}

export function generateLots(
  seed: number,
  count: number,
  products: Product[],
  customers: Customer[],
  routes: ProcessRoute[],
  toolIds: string[],
): Lot[] {
  const rng = mulberry32(seed)
  const lots: Lot[] = []
  const weekNum = '22' // Week 22 of 2026

  for (let i = 0; i < count; i++) {
    const product = pick(products, rng)
    const customer = pick(customers, rng)
    const route = pick(routes, rng)
    const currentStep = Math.floor(rng() * route.steps.length)
    const lotNum = String(i + 1).padStart(5, '0')

    // ~5% hot lots, ~1% super-hot
    const prioRoll = rng()
    const priority: Lot['priority'] =
      prioRoll > 0.99 ? 'super-hot' : prioRoll > 0.94 ? 'hot' : 'normal'

    // ~70% in-process, ~10% hold, ~10% complete, ~10% queued
    const statusRoll = rng()
    const status: Lot['status'] =
      statusRoll > 0.90 ? 'queued'
      : statusRoll > 0.80 ? 'complete'
      : statusRoll > 0.70 ? 'hold'
      : 'in-process'

    const currentToolId = status === 'in-process'
      ? pick(toolIds.filter(id => id.includes(route.steps[currentStep].toolType)), rng) || pick(toolIds, rng)
      : null

    // ~10% of lots have a parent (split lots)
    const parentLotId = i > 10 && rng() > 0.9
      ? lots[Math.floor(rng() * Math.min(i, lots.length))].lotId
      : null

    lots.push({
      lotId: `LOT-26${weekNum}W-${lotNum}`,
      productCode: product.productCode,
      customerName: customer.displayName,
      routeId: route.routeId,
      currentStep,
      totalSteps: route.steps.length,
      waferCount: [25, 25, 25, 13, 12][Math.floor(rng() * 5)],
      priority,
      status,
      currentToolId,
      startTime: `2026-05-${String(Math.floor(rng() * 28) + 1).padStart(2, '0')}T${String(Math.floor(rng() * 24)).padStart(2, '0')}:00:00`,
      parentLotId,
      childLotIds: [],
    })
  }

  // Wire up child references for split lots
  for (const lot of lots) {
    if (lot.parentLotId) {
      const parent = lots.find(l => l.lotId === lot.parentLotId)
      if (parent) parent.childLotIds.push(lot.lotId)
    }
  }

  return lots
}
