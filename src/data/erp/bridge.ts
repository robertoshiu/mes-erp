import type { EventBus } from '../../lib/eventBus'
import type { Clock } from '../../lib/clock'
import type { MasterData } from '../master'
import type { ProcessRoute } from '../master/routes'
import { useBridgedLots } from '../../lib/useBridgedLots'
import type { ErpData, BridgedLot } from './types'

// THE SPINE. The bridge owns the lifecycle of bridged lots because the MES
// engine's background lot.move carries a random routeStep and never completes,
// and there is no passive completion signal. On erp.prodorder.released the bridge
// creates a lot, drives it deterministically step-by-step across the floor
// (emitting lot.move so the Fab Floor wafer particles animate), and on the final
// step emits lot.complete + the "up" path (goods receipt, prod-order Completed,
// GL postings, invoice). In-flight lots are cleared on the loop boundary so they
// never orphan at the 180s wrap.

const STEP_SECONDS = 2.4 // wall time a bridged lot spends per route step

let bridgeSeq = 0

interface InFlight {
  lot: BridgedLot
  route: ProcessRoute
  qty: number
  salesOrderNo: string | null
  lastStepT: number
}

export interface Bridge {
  start(): void
  stop(): void
}

export function createBridge(
  clock: Clock,
  eventBus: EventBus,
  masterData: MasterData,
  erpData: ErpData,
): Bridge {
  const routeById = new Map(masterData.routes.map(r => [r.routeId, r]))
  const costOf = new Map(erpData.materials.map(m => [m.materialNo, m.standardCost]))

  // tool ids grouped by type, for routing lot.move between real bay tiles
  const toolsByType = new Map<string, string[]>()
  for (const eq of masterData.equipment) {
    const arr = toolsByType.get(eq.toolType) ?? []
    arr.push(eq.toolId)
    toolsByType.set(eq.toolType, arr)
  }
  const operatorIds = masterData.operators.map(o => o.operatorId)

  const inFlight = new Map<string, InFlight>()
  let pickCursor = 0
  const toolOf = (toolType: string): string => {
    const arr = toolsByType.get(toolType)
    if (arr && arr.length) return arr[pickCursor++ % arr.length]
    const all = masterData.equipment
    return all.length ? all[pickCursor++ % all.length].toolId : 'EQP-UNKNOWN'
  }
  const operatorOf = (): string =>
    operatorIds.length ? operatorIds[pickCursor % operatorIds.length] : 'OP-MRP'

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let subRelease: { unsubscribe: () => void } | null = null
  let unsubBoundary: (() => void) | null = null

  function onReleased(e: Extract<import('../../lib/erpEvents').ErpEvent, { topic: 'erp.prodorder.released' }>) {
    const route = routeById.get(e.routeId)
    // Guard: a released order whose route is missing/empty can't progress — skip it.
    if (!route || route.steps.length === 0) return
    const t = clock.loopT()
    const lot: BridgedLot = {
      lotId: `LOT-ERP-${bridgeSeq++}`,
      prodOrderNo: e.orderNo,
      materialNo: e.materialNo,
      productCode: e.productCode,
      routeId: e.routeId,
      totalSteps: route.steps.length,
      currentStep: 0,
      status: 'in-process',
      startedT: t,
    }
    useBridgedLots.getState().addLot(lot)
    inFlight.set(lot.lotId, { lot, route, qty: e.qty, salesOrderNo: e.salesOrderNo, lastStepT: t })
    eventBus.publish({ topic: 'erp.prodorder.status', t, orderNo: e.orderNo, status: 'InProcess' })
  }

  function completeLot(f: InFlight, t: number) {
    const { lot, qty, salesOrderNo } = f
    useBridgedLots.getState().completeLot(lot.lotId)
    inFlight.delete(lot.lotId)

    eventBus.publish({
      topic: 'lot.complete', t,
      lotId: lot.lotId, prodOrderNo: lot.prodOrderNo,
      materialNo: lot.materialNo, productCode: lot.productCode, qty,
    })
    // Up path: goods receipt into FG, order Completed, cost postings, invoice.
    const unitCost = costOf.get(lot.materialNo) ?? 1200
    const value = Math.round(qty * unitCost)
    eventBus.publish({ topic: 'erp.goods.movement', t, movementType: 'GR', materialNo: lot.materialNo, qty, storageLoc: 'FG' })
    eventBus.publish({ topic: 'erp.prodorder.status', t, orderNo: lot.prodOrderNo, status: 'Completed' })
    eventBus.publish({ topic: 'erp.gl.posting', t, accountNo: '130000', accountName: 'Finished Goods', amount: value, ref: lot.prodOrderNo })
    eventBus.publish({ topic: 'erp.gl.posting', t, accountNo: '120000', accountName: 'WIP', amount: -value, ref: lot.prodOrderNo })
    if (salesOrderNo) {
      eventBus.publish({ topic: 'erp.invoice.created', t, invoiceNo: `INV-${700000 + bridgeSeq}`, orderNo: salesOrderNo, amount: Math.round(value * 1.35) })
    }
  }

  function tick() {
    const t = clock.loopT()
    for (const f of [...inFlight.values()]) {
      // If the clock wrapped (t < lastStepT) the boundary handler will have reset; skip.
      const elapsed = t - f.lastStepT
      if (elapsed < STEP_SECONDS) continue
      const next = f.lot.currentStep + 1
      if (next < f.lot.totalSteps) {
        const fromTool = toolOf(f.route.steps[f.lot.currentStep].toolType)
        const toTool = toolOf(f.route.steps[next].toolType)
        eventBus.publish({
          topic: 'lot.move', t,
          lotId: f.lot.lotId, fromToolId: fromTool, toToolId: toTool,
          routeStep: next, operatorId: operatorOf(),
          productCode: f.lot.productCode, customerName: 'MRP',
        })
        f.lot.currentStep = next
        useBridgedLots.getState().advanceLot(f.lot.lotId, next)
        f.lastStepT = t
      } else {
        completeLot(f, t)
      }
    }
  }

  function onBoundary() {
    // Critical: clear in-flight schedules + the store so lots don't orphan at the wrap.
    inFlight.clear()
    useBridgedLots.getState().reset()
  }

  function start() {
    subRelease = eventBus.ofTopic('erp.prodorder.released').subscribe(onReleased)
    unsubBoundary = clock.onLoopBoundary(onBoundary)
    tickInterval = setInterval(tick, 200)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (subRelease) subRelease.unsubscribe()
    if (unsubBoundary) unsubBoundary()
  }

  return { start, stop }
}
