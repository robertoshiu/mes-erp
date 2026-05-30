import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import { Radio } from 'lucide-react'
import type { AppEvent, AppTopic } from '../lib/events'
import { cn } from '@/lib/utils'

interface EventStreamProps {
  events$: Observable<AppEvent>
  maxVisible?: number
  /**
   * Optional backfill from the event ring buffer (oldest→newest). Lets a
   * late-mounting stream hydrate with recent history instead of starting blank.
   * Kept prop-driven so EventStream never imports the bus directly.
   */
  seed?: AppEvent[]
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
    case 'alarm.ack': return `${event.alarmId} acknowledged by ${event.operatorId}`
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

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-l-[3px] border-l-critical bg-critical/10',
  major: 'border-l-[3px] border-l-warn bg-warn/[0.07]',
  minor: 'border-l-2 border-l-warn/60',
  routine: 'border-l border-l-white/[0.06]',
}

// Layer grouping derived from the topic prefix: SCM = scm.*, ERP = erp.*, and
// MES = everything else (lot.*, equip.state, spc.violation, alarm.*, recipe.load,
// kpi.tick, shift.boundary, lot.complete).
type EventGroup = 'MES' | 'ERP' | 'SCM'
const EVENT_GROUPS: EventGroup[] = ['MES', 'ERP', 'SCM']

function groupOf(topic: AppTopic): EventGroup {
  if (topic.startsWith('scm.')) return 'SCM'
  if (topic.startsWith('erp.')) return 'ERP'
  return 'MES'
}

// Representative chip color per layer, lifted straight from TOPIC_META so the
// filter chips share the live-feed palette (MES=lot.move, ERP=erp.po.created,
// SCM=scm.forecast.updated).
const GROUP_COLOR: Record<EventGroup, string> = {
  MES: TOPIC_META['lot.move'].color,
  ERP: TOPIC_META['erp.po.created'].color,
  SCM: TOPIC_META['scm.forecast.updated'].color,
}

/** Wrap a raw bus event in a DisplayEvent (shared by the live feed + seed). */
function toDisplayEvent(event: AppEvent): DisplayEvent {
  const severity = severityOf(event)
  const shouldPin = severity === 'critical' || severity === 'major'
  return {
    event,
    id: ++eventCounter,
    pinned: shouldPin,
    pinnedUntil: shouldPin ? Date.now() + 10_000 : 0,
  }
}

export function EventStream({ events$, maxVisible = 50, seed }: EventStreamProps) {
  // Backfill from the ring buffer (oldest→newest) so the feed isn't blank on
  // first navigate: reverse to newest-first, wrap, then cap at maxVisible.
  const [items, setItems] = useState<DisplayEvent[]>(() => {
    if (!seed || seed.length === 0) return []
    return [...seed].reverse().map(toDisplayEvent).slice(0, maxVisible)
  })
  const [paused, setPaused] = useState(false)
  const [activeGroups, setActiveGroups] = useState<Set<EventGroup>>(
    () => new Set<EventGroup>(EVENT_GROUPS),
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  // Display-only filter: ingestion in the subscribe handler keeps ALL events in
  // `items`, so re-enabling a layer instantly reveals already-buffered rows.
  const visibleItems = items.filter(item => activeGroups.has(groupOf(item.event.topic)))

  function toggleGroup(group: EventGroup) {
    setActiveGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  useEffect(() => {
    const sub = events$.subscribe(event => {
      const entry = toDisplayEvent(event)

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
    <div className="flex flex-col h-full min-h-0">
      {/* Control row — explicit pause toggle + layer filter chips (dark HUD). */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-edge bg-surface-3/50">
        <div className="flex items-center gap-1.5">
          {EVENT_GROUPS.map(group => {
            const active = activeGroups.has(group)
            const color = GROUP_COLOR[group]
            return (
              <button
                key={group}
                type="button"
                onClick={() => toggleGroup(group)}
                aria-pressed={active}
                title={`${active ? 'Hide' : 'Show'} ${group} layer events`}
                className={cn(
                  'font-mono text-[9px] font-semibold tracking-wider px-1 rounded transition-opacity',
                  !active && 'opacity-40',
                )}
                style={{ color, background: `${color}1a` }}
              >
                {group}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setPaused(p => !p)}
          aria-pressed={paused}
          title={paused ? 'Resume live feed' : 'Pause live feed'}
          className={cn(
            'inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-edge transition-colors',
            paused ? 'text-warn' : 'text-success hover:text-ink-1',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              !paused && 'animate-pulse-soft',
            )}
            style={
              paused
                ? { background: '#FBBF24' }
                : { background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }
            }
            aria-hidden
          />
          {paused ? 'Paused' : 'Live'}
        </button>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex-1 min-h-0 overflow-y-auto text-xs"
      >
        {visibleItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-accent/10 ring-1 ring-accent/30">
              <Radio size={20} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
            </span>
            <div className="text-[12px] font-semibold text-accent text-glow-soft">
              {items.length === 0 ? 'Bus listening' : 'No events match the active layers'}
            </div>
            <div className="text-[11px] text-ink-3">
              {items.length === 0
                ? 'Live events appear the moment the floor reports in.'
                : 'Re-enable a layer chip above to reveal its events.'}
            </div>
          </div>
        ) : (
          visibleItems.map(item => {
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
          })
        )}
      </div>
    </div>
  )
}
