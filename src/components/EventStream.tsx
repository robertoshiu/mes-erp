import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import type { AppEvent, AppTopic } from '../lib/events'
import { cn } from '@/lib/utils'

interface EventStreamProps {
  events$: Observable<AppEvent>
  maxVisible?: number
}

interface DisplayEvent {
  event: AppEvent
  id: number
  pinned: boolean
  pinnedUntil: number
}

let eventCounter = 0

function severityOf(event: AppEvent): 'critical' | 'major' | 'minor' | 'routine' {
  if (event.topic === 'alarm.raised') {
    return event.severity === 'critical' ? 'critical' : event.severity === 'major' ? 'major' : 'minor'
  }
  if (event.topic === 'spc.violation' && event.severity === 'critical') return 'critical'
  if (event.topic === 'spc.violation') return 'major'
  return 'routine'
}

function eventMessage(event: AppEvent): string {
  switch (event.topic) {
    case 'lot.move': return `${event.lotId} → ${event.toToolId} (step ${event.routeStep})`
    case 'equip.state': return `${event.toolId}: ${event.fromState} → ${event.toState}`
    case 'spc.violation': return `Rule ${event.ruleNumber}: ${event.controlPoint.value.toFixed(2)} (UCL ${event.controlPoint.ucl.toFixed(2)})`
    case 'alarm.raised': return event.message
    case 'recipe.load': return `${event.toolId} ← ${event.recipeId} ${event.recipeVersion}`
    case 'kpi.tick': return `OEE ${(event.oee * 100).toFixed(1)}% · Yield ${(event.yieldPct * 100).toFixed(1)}%`
    case 'shift.boundary': return `Shift ${event.kind}: ${event.shiftCode}`
    case 'lot.complete': return `${event.lotId} complete · PO ${event.prodOrderNo}`
    case 'erp.order.created': return `SO ${event.orderNo} · ${event.customerName} ×${event.qty}`
    case 'erp.mrp.run': return `MRP run · ${event.shortages} shortages, ${event.plannedOrders} planned`
    case 'erp.plannedorder.created': return `Planned ${event.plannedOrderNo} · ${event.materialNo} ×${event.qty}`
    case 'erp.prodorder.released': return `Released ${event.orderNo} → ${event.materialNo} ×${event.qty}`
    case 'erp.prodorder.status': return `${event.orderNo}: ${event.status}`
    case 'erp.goods.movement': return `${event.movementType} ${event.materialNo} ×${event.qty} @ ${event.storageLoc}`
    case 'erp.po.created': return `PO ${event.poNo} · ${event.vendorName} ${event.materialNo} ×${event.qty}`
    case 'erp.po.received': return `PO ${event.poNo} received · ${event.materialNo} ×${event.qty}`
    case 'erp.gl.posting': return `GL ${event.accountNo} ${event.amount >= 0 ? '+' : ''}${Math.round(event.amount).toLocaleString()} · ${event.ref}`
    case 'erp.invoice.created': return `Invoice ${event.invoiceNo} · ${event.orderNo} $${Math.round(event.amount).toLocaleString()}`
    case 'scm.forecast.updated': return `Forecast ${event.materialNo} · bucket ${event.bucket} → ${event.qty}`
    case 'scm.shipment.created': return `Ship ${event.shipmentNo} · ${event.fromNode} → ${event.toNode} · ${event.materialNo} ×${event.qty}`
    case 'scm.shipment.departed': return `Ship ${event.shipmentNo} departed · ${event.fromNode} → ${event.toNode}`
    case 'scm.shipment.arrived': return `Ship ${event.shipmentNo} arrived @ ${event.toNode} · ${event.materialNo} ×${event.qty}`
    case 'scm.shipment.delivered': return `Ship ${event.shipmentNo} delivered @ ${event.toNode} · ${event.materialNo} ×${event.qty}`
    case 'scm.atp.promised': return `ATP ${event.salesOrderNo} · ${event.materialNo} ${event.promisedDate} (avail ${event.available})`
    case 'scm.supplier.asn': return `ASN ${event.supplierName} · ${event.materialNo} ×${event.qty}`
    case 'scm.disruption.raised': return `Disruption ${event.laneId} · ${event.fromNode} → ${event.toNode}: ${event.reason}`
    case 'scm.disruption.cleared': return `Cleared ${event.laneId} · ${event.fromNode} → ${event.toNode}`
  }
}

const TOPIC_META: Record<AppTopic, { short: string; color: string }> = {
  'lot.move': { short: 'LOT', color: '#38BDF8' },
  'equip.state': { short: 'EQP', color: '#818CF8' },
  'spc.violation': { short: 'SPC', color: '#FBBF24' },
  'alarm.raised': { short: 'ALM', color: '#FB7185' },
  'recipe.load': { short: 'RCP', color: '#34D399' },
  'kpi.tick': { short: 'KPI', color: '#22D3EE' },
  'shift.boundary': { short: 'SFT', color: '#74849E' },
  'lot.complete': { short: 'DONE', color: '#34D399' },
  'erp.order.created': { short: 'SO', color: '#38BDF8' },
  'erp.mrp.run': { short: 'MRP', color: '#818CF8' },
  'erp.plannedorder.created': { short: 'PLN', color: '#818CF8' },
  'erp.prodorder.released': { short: 'PRD', color: '#22D3EE' },
  'erp.prodorder.status': { short: 'PRD', color: '#22D3EE' },
  'erp.goods.movement': { short: 'MOV', color: '#34D399' },
  'erp.po.created': { short: 'PO', color: '#FBBF24' },
  'erp.po.received': { short: 'PO', color: '#34D399' },
  'erp.gl.posting': { short: 'GL', color: '#94A3B8' },
  'erp.invoice.created': { short: 'INV', color: '#38BDF8' },
  'scm.forecast.updated': { short: 'FCST', color: '#818CF8' },
  'scm.shipment.created': { short: 'SHIP', color: '#38BDF8' },
  'scm.shipment.departed': { short: 'SHIP', color: '#38BDF8' },
  'scm.shipment.arrived': { short: 'ARRV', color: '#34D399' },
  'scm.shipment.delivered': { short: 'DLVD', color: '#34D399' },
  'scm.atp.promised': { short: 'ATP', color: '#22D3EE' },
  'scm.supplier.asn': { short: 'ASN', color: '#FBBF24' },
  'scm.disruption.raised': { short: 'DSRP', color: '#F43F5E' },
  'scm.disruption.cleared': { short: 'CLR', color: '#34D399' },
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-l-[3px] border-l-critical bg-critical/10',
  major: 'border-l-[3px] border-l-warn bg-warn/[0.07]',
  minor: 'border-l-2 border-l-warn/60',
  routine: 'border-l border-l-white/[0.06]',
}

export function EventStream({ events$, maxVisible = 50 }: EventStreamProps) {
  const [items, setItems] = useState<DisplayEvent[]>([])
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sub = events$.subscribe(event => {
      const severity = severityOf(event)
      const shouldPin = severity === 'critical' || severity === 'major'
      const entry: DisplayEvent = {
        event,
        id: ++eventCounter,
        pinned: shouldPin,
        pinnedUntil: shouldPin ? Date.now() + 10_000 : 0,
      }

      setItems(prev => {
        const unpinned = prev.map(item => ({
          ...item,
          pinned: item.pinned && Date.now() < item.pinnedUntil,
        }))
        const next = [entry, ...unpinned].slice(0, maxVisible)
        next.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.id - a.id
        })
        return next
      })
    })
    return () => sub.unsubscribe()
  }, [events$, maxVisible])

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [items, paused])

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto text-xs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map(item => {
        const severity = severityOf(item.event)
        const meta = TOPIC_META[item.event.topic]
        return (
          <div
            key={item.id}
            className={cn(
              'px-2.5 py-1.5 transition-colors hover:bg-surface-3/50',
              SEVERITY_STYLES[severity],
              item.pinned && severity !== 'routine' && 'animate-rise',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
              />
              <span
                className="font-mono text-[9px] font-semibold tracking-wider px-1 rounded"
                style={{ color: meta.color, background: `${meta.color}1a` }}
              >
                {meta.short}
              </span>
              <span className="font-mono text-[10px] text-ink-mute ml-auto tabular-nums">
                {item.event.t.toFixed(1)}s
              </span>
            </div>
            <div className={cn('mt-1 leading-snug', severity === 'critical' ? 'text-ink-1 font-medium' : 'text-ink-2')}>
              {eventMessage(item.event)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
