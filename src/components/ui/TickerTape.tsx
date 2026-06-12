import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import type { AppEvent, AppTopic } from '@/lib/events'
import { cn } from '@/lib/utils'

interface TickerTapeProps {
  source$: Observable<AppEvent>
  /** Restrict to these topics; omit to accept all. */
  accept?: AppTopic[]
  /** Ring-buffer cap of retained items. */
  max?: number
  className?: string
}

interface TickerItem {
  id: number
  topic: AppTopic
  short: string
  color: string
  text: string
}

let tickerCounter = 0

// Short tag + dot color per topic, lifted from the same palette EventStream uses.
const TOPIC_TAG: Record<AppTopic, { short: string; color: string }> = {
  'lot.move': { short: 'LOT', color: '#38BDF8' },
  'equip.state': { short: 'EQP', color: '#60A5FA' },
  'spc.violation': { short: 'SPC', color: '#FBBF24' },
  'alarm.raised': { short: 'ALM', color: '#FB7185' },
  'alarm.ack': { short: 'ACK', color: '#34D399' },
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
  'erp.gl.posting': { short: 'GL', color: '#74849E' },
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

/** Compact one-line summary per event (terser than EventStream's). */
function shortText(event: AppEvent): string {
  switch (event.topic) {
    case 'lot.move': return `${event.lotId} → ${event.toToolId}`
    case 'equip.state': return `${event.toolId} ${event.toState}`
    case 'spc.violation': return `Rule ${event.ruleNumber} ${event.controlPoint.value.toFixed(1)}`
    case 'alarm.raised': return event.message
    case 'alarm.ack': return `${event.alarmId} ack`
    case 'recipe.load': return `${event.toolId} ← ${event.recipeId}`
    case 'kpi.tick': return `OEE ${(event.oee * 100).toFixed(0)}%`
    case 'shift.boundary': return `Shift ${event.shiftCode} ${event.kind}`
    case 'lot.complete': return `${event.lotId} done`
    case 'erp.order.created': return `SO ${event.orderNo} ×${event.qty}`
    case 'erp.mrp.run': return `MRP ${event.shortages} short`
    case 'erp.plannedorder.created': return `${event.materialNo} ×${event.qty}`
    case 'erp.prodorder.released': return `${event.orderNo} ×${event.qty}`
    case 'erp.prodorder.status': return `${event.orderNo} ${event.status}`
    case 'erp.goods.movement': return `${event.movementType} ${event.materialNo} ×${event.qty}`
    case 'erp.po.created': return `PO ${event.poNo} ×${event.qty}`
    case 'erp.po.received': return `PO ${event.poNo} recv`
    case 'erp.gl.posting': return `${event.accountNo} ${Math.round(event.amount).toLocaleString()}`
    case 'erp.invoice.created': return `INV ${event.invoiceNo}`
    case 'scm.forecast.updated': return `${event.materialNo} → ${event.qty}`
    case 'scm.shipment.created': return `${event.shipmentNo} ${event.fromNode}→${event.toNode}`
    case 'scm.shipment.departed': return `${event.shipmentNo} departed`
    case 'scm.shipment.arrived': return `${event.shipmentNo} @ ${event.toNode}`
    case 'scm.shipment.delivered': return `${event.shipmentNo} delivered`
    case 'scm.atp.promised': return `ATP ${event.salesOrderNo}`
    case 'scm.supplier.asn': return `ASN ${event.materialNo} ×${event.qty}`
    case 'scm.disruption.raised': return `${event.laneId} ${event.reason}`
    case 'scm.disruption.cleared': return `${event.laneId} cleared`
  }
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Live horizontal event ticker. New events slide in (animate-rise), severity-
 *  toned dot + mono short text. Hover pauses the marquee (CSS). Reduced-motion
 *  renders a static, non-scrolling list. Same subscribe/unsubscribe pattern as
 *  EventStream (subscribe in effect, accept filter applied in-handler). */
export function TickerTape({ source$, accept, max = 24, className }: TickerTapeProps) {
  const [items, setItems] = useState<TickerItem[]>([])
  const acceptRef = useRef(accept)
  acceptRef.current = accept
  const reduced = reducedMotion()

  useEffect(() => {
    const sub = source$.subscribe(event => {
      const allow = acceptRef.current
      if (allow && !allow.includes(event.topic)) return
      const tag = TOPIC_TAG[event.topic]
      const entry: TickerItem = {
        id: ++tickerCounter,
        topic: event.topic,
        short: tag.short,
        color: tag.color,
        text: shortText(event),
      }
      setItems(prev => [entry, ...prev].slice(0, max))
    })
    return () => sub.unsubscribe()
  }, [source$, max])

  function Cell({ item }: { item: TickerItem }) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
          aria-hidden
        />
        <span
          className="font-mono text-[9px] font-semibold tracking-wider"
          style={{ color: item.color }}
        >
          {item.short}
        </span>
        <span className="font-mono text-[10px] text-ink-2 whitespace-nowrap">{item.text}</span>
        <span className="text-ink-mute" aria-hidden>·</span>
      </span>
    )
  }

  // Reduced-motion / empty: static flow-wrapped list (newest first), no marquee.
  if (reduced || items.length === 0) {
    return (
      <div
        role="log"
        aria-live="polite"
        className={cn('flex items-center overflow-hidden h-6 text-xs', className)}
      >
        {items.length === 0 ? (
          <span className="px-3 font-mono text-[10px] text-ink-mute">Awaiting events…</span>
        ) : (
          <div className="flex items-center overflow-hidden">
            {items.map(item => (
              <span key={item.id} className="animate-rise inline-flex">
                <Cell item={item} />
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      role="log"
      aria-live="polite"
      className={cn('ticker-pausable relative overflow-hidden h-6', className)}
    >
      {/* Two copies of the track so the -50% marquee loops seamlessly. */}
      <div className="animate-ticker flex items-center w-max">
        {[0, 1].map(copy => (
          <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
            {items.map(item => (
              <Cell key={`${copy}-${item.id}`} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
