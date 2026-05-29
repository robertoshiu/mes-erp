import { useMemo } from 'react'
import { ShoppingCart, ListOrdered, PackageCheck, AlertTriangle } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { Gauge } from '../../components/ui/Gauge'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { cyrb53 } from '../../data/prng'
import { cn } from '../../lib/utils'
import type { SalesOrder, SalesOrderLine, OrderStatus, ErpData } from '../../data/erp/types'
import type { ErpModuleProps } from './types'

/** USD formatter for net values — deterministic, no locale wall-clock surprises. */
const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** Compact integer formatter for the ATP availability counts. */
const qtyFmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** Colored status dot + label. open=accent, in-process=success, hold=warn, complete=ink-3. */
function StatusCell({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { dot: string; text: string; label: string; glow?: string }> = {
    open: { dot: 'bg-accent', text: 'text-accent', label: 'Open', glow: 'var(--accent-glow)' },
    'in-process': { dot: 'bg-success', text: 'text-success', label: 'In-Process', glow: 'rgba(52, 211, 153, 0.55)' },
    hold: { dot: 'bg-warn', text: 'text-warn', label: 'Hold', glow: 'rgba(251, 191, 36, 0.55)' },
    complete: { dot: 'bg-ink-mute', text: 'text-ink-3', label: 'Complete' },
  }
  const s = map[status]
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)}
        style={s.glow ? { boxShadow: `0 0 6px ${s.glow}` } : undefined}
      />
      <span className={cn('text-[11px] truncate', s.text)}>{s.label}</span>
    </span>
  )
}

/** Priority chip: super-hot pulses critical, hot is amber, normal is a muted dash. */
function PriorityCell({ priority }: { priority: SalesOrder['priority'] }) {
  if (priority === 'super-hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-critical text-white animate-pulse-soft">
        <span className="relative inline-flex w-1.5 h-1.5 shrink-0" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-critical" />
          <span className="animate-sonar absolute inset-0 rounded-full border border-critical" />
        </span>
        Super-Hot
      </span>
    )
  }
  if (priority === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-warn/20 text-warn border border-warn/30">
        <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse-soft shrink-0" aria-hidden />
        Hot
      </span>
    )
  }
  return <span className="text-[11px] text-ink-3" aria-label="normal priority">&mdash;</span>
}

/** Label/value pair in the drill-in detail grid (matches Production's DetailField). */
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

/** Uppercase tracked section heading with a small accent icon. */
function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      <span className="text-accent flex items-center">{icon}</span>
      {text}
    </div>
  )
}

/** Dark zebra list of order lines. */
function LineItems({ lines }: { lines: SalesOrderLine[] }) {
  return (
    <div className="mt-2 rounded-md border border-edge overflow-hidden">
      {/* column header */}
      <div className="flex items-center bg-surface-3/60 border-b border-edge text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        <span className="w-9 px-2.5 py-1.5 text-center shrink-0">#</span>
        <span className="w-28 px-2 py-1.5 shrink-0">Material</span>
        <span className="flex-1 px-2 py-1.5 min-w-0">Description</span>
        <span className="w-16 px-2 py-1.5 text-right shrink-0">Qty</span>
        <span className="w-24 px-2.5 py-1.5 text-right shrink-0">Net Price</span>
      </div>
      {lines.map((line, i) => (
        <div
          key={line.lineNo}
          className={cn(
            'flex items-center text-[11px] border-b border-white/[0.04] last:border-b-0',
            i % 2 === 1 && 'bg-white/[0.015]',
          )}
        >
          <span className="w-9 px-2.5 py-1.5 text-center font-mono tabular-nums text-ink-3 shrink-0">{line.lineNo}</span>
          <span className="w-28 px-2 py-1.5 font-mono text-ink-2 truncate shrink-0">{line.materialNo}</span>
          <span className="flex-1 px-2 py-1.5 text-ink-1 truncate min-w-0">{line.description}</span>
          <span className="w-16 px-2 py-1.5 text-right font-mono tabular-nums text-ink-2 shrink-0">{line.qty}</span>
          <span className="w-24 px-2.5 py-1.5 text-right font-mono tabular-nums text-ink-1 shrink-0">{usd(line.netPrice)}</span>
        </div>
      ))}
    </div>
  )
}

/* ===========================================================================
   ATP / Order Promising — folded into Sales Orders (plan Issue 4, DRY).
   SCM shipment/atp data is NOT in scope of ErpModuleProps, so a believable ATP
   is derived deterministically from erpData alone (no SCM coupling, no signature
   change): on-hand from FERT inventory, in-transit from inbound POs, planned
   production from released/in-process production orders, demand from committed
   sales-order lines. Per-order promise status is derived via cyrb53(orderNo) so
   it is stable across reloads (no wall-clock, no runtime PRNG).
   =========================================================================== */

type AtpStatus = 'confirmed' | 'partial' | 'shortfall'

interface AtpSupply {
  onHand: number
  inTransit: number
  plannedProduction: number
  demand: number
  /** max(0, demand − supply) — what cannot be promised on current coverage. */
  shortfall: number
  /** on-hand + in-transit + planned production. */
  available: number
}

/** Aggregate finished-goods ATP coverage, derived from the ERP snapshot only. */
function deriveAtp(erpData: ErpData): AtpSupply {
  // On-hand finished goods (FG storage loc if present, else all FERT rows).
  const ferts = new Set(erpData.materials.filter(m => m.type === 'FERT').map(m => m.materialNo))
  const fgRows = erpData.inventory.filter(r => ferts.has(r.materialNo))
  const onHand = fgRows.reduce((s, r) => s + Math.max(0, r.onHand), 0)

  // In-transit inbound replenishment — open/confirmed POs not yet received.
  const inTransit = erpData.purchaseOrders
    .filter(po => po.status === 'open' || po.status === 'confirmed')
    .reduce((s, po) => s + po.lines.reduce((ls, l) => ls + l.qty, 0), 0)

  // Planned production — FG coming off the floor (released / in-process orders).
  const plannedProduction = erpData.productionOrders
    .filter(o => o.status === 'Released' || o.status === 'InProcess')
    .reduce((s, o) => s + o.targetQty, 0)

  // Committed demand — open + in-process sales-order line qty we have promised.
  const demand = erpData.salesOrders
    .filter(o => o.status === 'open' || o.status === 'in-process')
    .reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty, 0), 0)

  const available = onHand + inTransit + plannedProduction
  const shortfall = Math.max(0, demand - available)
  return { onHand, inTransit, plannedProduction, demand, shortfall, available }
}

/**
 * Per-order ATP promise status. Deterministic from the order key + whether the
 * network is in aggregate shortfall: most orders confirm, a stable subset slip
 * to partial, and (when the book is short) expedited orders that can't be
 * covered read as a shortfall. cyrb53 keeps it identical across reloads.
 */
function atpStatusFor(order: SalesOrder, short: boolean): AtpStatus {
  if (order.status === 'complete') return 'confirmed'
  const roll = (cyrb53(order.orderNo, 7) % 1000) / 1000
  const expedited = order.priority === 'hot' || order.priority === 'super-hot'
  if (short && expedited && roll < 0.55) return 'shortfall'
  if (roll < (short ? 0.22 : 0.12)) return 'partial'
  return 'confirmed'
}

/** Deterministic promised-date slip past the requested date for non-confirmed orders. */
function promisedDateFor(order: SalesOrder, status: AtpStatus): string {
  if (status === 'confirmed') return order.requestedDate
  const slip = status === 'shortfall'
    ? 7 + (cyrb53(order.orderNo, 11) % 14)   // 7..20 days
    : 1 + (cyrb53(order.orderNo, 11) % 6)    // 1..6 days
  return addDays(order.requestedDate, slip)
}

/** Add N days to a 'YYYY-MM-DD' string. Pure — never reads the system clock. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  // UTC math keeps it timezone- and wall-clock-independent.
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  const dt = new Date(t)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const ATP_META: Record<AtpStatus, { label: string; dot: string; text: string; chip: string; glow?: string }> = {
  confirmed: { label: 'Confirmed', dot: 'bg-success', text: 'text-success', chip: 'bg-success/10 border-success/25', glow: 'rgba(52, 211, 153, 0.55)' },
  partial: { label: 'Partial', dot: 'bg-warn', text: 'text-warn', chip: 'bg-warn/15 border-warn/30', glow: 'rgba(251, 191, 36, 0.55)' },
  shortfall: { label: 'Shortfall', dot: 'bg-critical', text: 'text-critical', chip: 'bg-critical/15 border-critical/30', glow: 'rgba(244, 63, 94, 0.6)' },
}

/** ATP confirmation chip — glow-ring tone map, shortfall pulses. */
function AtpCell({ status }: { status: AtpStatus }) {
  const s = ATP_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm border',
        s.chip, s.text, status === 'shortfall' && 'animate-pulse-soft',
      )}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot, status === 'shortfall' && 'animate-pulse-soft')}
        style={s.glow ? { boxShadow: `0 0 6px ${s.glow}` } : undefined}
        aria-hidden
      />
      {s.label}
    </span>
  )
}

/** One segment of the ATP availability bar. */
interface AtpSegment { key: string; label: string; value: number; bar: string; dot: string; text: string; glow: string }

/**
 * Compact ATP availability panel: a segmented horizontal bar
 * (on-hand / in-transit / planned-production / shortfall) + a committed-vs-
 * available radial Gauge. Shortfall pulses .row-superhot (plan Visual Spec C).
 */
function AtpAvailabilityPanel({ atp }: { atp: AtpSupply }) {
  const segments: AtpSegment[] = [
    { key: 'onHand', label: 'On Hand', value: atp.onHand, bar: 'bg-success', dot: 'bg-success', text: 'text-success', glow: 'rgba(52, 211, 153, 0.55)' },
    { key: 'inTransit', label: 'In Transit', value: atp.inTransit, bar: 'bg-info', dot: 'bg-info', text: 'text-info', glow: 'rgba(56, 189, 248, 0.5)' },
    { key: 'planned', label: 'Planned Prod.', value: atp.plannedProduction, bar: 'bg-accent-3', dot: 'bg-accent-3', text: 'text-accent-3', glow: 'rgba(129, 140, 248, 0.5)' },
    { key: 'shortfall', label: 'Shortfall', value: atp.shortfall, bar: 'bg-critical', dot: 'bg-critical', text: 'text-critical', glow: 'rgba(244, 63, 94, 0.6)' },
  ]
  // Bar spans coverage vs demand: supply segments + any uncovered shortfall.
  const total = Math.max(1, atp.available + atp.shortfall)
  const short = atp.shortfall > 0
  // Gauge: committed demand against available supply (coverage %).
  const coverage = atp.demand > 0 ? Math.min(100, (atp.available / atp.demand) * 100) : 100
  const gaugeColor = short ? '#F43F5E' : coverage >= 99 ? '#34D399' : '#FBBF24'

  return (
    <div className="px-3.5 py-3 border-b border-edge bg-surface-3/30">
      <div className="flex items-start gap-5">
        {/* Segmented availability bar + legend */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle icon={<PackageCheck size={13} strokeWidth={1.9} />} text="Available to Promise" />
            <span className="text-[10px] text-ink-3">
              demand <span className="font-mono tabular-nums text-ink-2">{qtyFmt(atp.demand)}</span>
              <span className="mx-1 text-ink-mute">/</span>
              available <span className="font-mono tabular-nums text-ink-1">{qtyFmt(atp.available)}</span>
            </span>
          </div>

          <div
            className={cn(
              'flex h-3 w-full rounded-full overflow-hidden border border-edge bg-surface-2',
              short && 'row-superhot',
            )}
            role="img"
            aria-label={`ATP coverage: ${qtyFmt(atp.available)} available against ${qtyFmt(atp.demand)} committed`}
          >
            {segments.map(seg =>
              seg.value > 0 ? (
                <span
                  key={seg.key}
                  className={cn(seg.bar, seg.key === 'shortfall' && 'animate-pulse-soft')}
                  style={{ width: `${(seg.value / total) * 100}%`, boxShadow: `0 0 8px -1px ${seg.glow}` }}
                  title={`${seg.label}: ${qtyFmt(seg.value)}`}
                />
              ) : null,
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
            {segments.map(seg => (
              <span key={seg.key} className="inline-flex items-center gap-1.5 text-[10px] text-ink-3">
                <span
                  className={cn('w-2 h-2 rounded-[2px] shrink-0', seg.dot)}
                  style={{ boxShadow: `0 0 6px ${seg.glow}` }}
                  aria-hidden
                />
                <span className="uppercase tracking-[0.1em]">{seg.label}</span>
                <span className={cn('font-mono tabular-nums', seg.value > 0 ? seg.text : 'text-ink-mute')}>
                  {qtyFmt(seg.value)}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Committed-vs-available gauge */}
        <div className="shrink-0 flex flex-col items-center">
          <Gauge
            value={coverage}
            max={100}
            size={88}
            stroke={8}
            color={gaugeColor}
            valueText={`${Math.round(coverage)}%`}
            label="Covered"
          />
        </div>
      </div>
    </div>
  )
}

/** Sales-order row enriched with the derived ATP promise (kept on-system, additive). */
type AtpOrder = SalesOrder & { atpStatus: AtpStatus; promisedDate: string }

const cols: Column<AtpOrder>[] = [
  {
    key: 'orderNo', header: 'Order No', width: 130, mono: true,
    render: r => r.orderNo,
    sortFn: (a, b) => a.orderNo.localeCompare(b.orderNo),
  },
  {
    key: 'customerName', header: 'Customer', width: 170,
    render: r => r.customerName,
    sortFn: (a, b) => a.customerName.localeCompare(b.customerName),
  },
  {
    key: 'status', header: 'Status', width: 116,
    render: r => <StatusCell status={r.status} />,
    sortFn: (a, b) => a.status.localeCompare(b.status),
  },
  {
    key: 'priority', header: 'Priority', width: 104,
    render: r => <PriorityCell priority={r.priority} />,
    sortFn: (a, b) => {
      const rank: Record<SalesOrder['priority'], number> = { 'super-hot': 0, hot: 1, normal: 2 }
      return rank[a.priority] - rank[b.priority]
    },
  },
  {
    key: 'requestedDate', header: 'Requested', width: 114, mono: true,
    render: r => r.requestedDate,
    sortFn: (a, b) => a.requestedDate.localeCompare(b.requestedDate),
  },
  {
    key: 'promisedDate', header: 'Promised', width: 114, mono: true,
    render: r => {
      const slipped = r.promisedDate !== r.requestedDate
      return (
        <span className={cn('font-mono tabular-nums', slipped ? 'text-warn text-glow-soft' : 'text-ink-2')}>
          {r.promisedDate}
        </span>
      )
    },
    sortFn: (a, b) => a.promisedDate.localeCompare(b.promisedDate),
  },
  {
    key: 'atpStatus', header: 'ATP', width: 120,
    render: r => <AtpCell status={r.atpStatus} />,
    sortFn: (a, b) => {
      const rank: Record<AtpStatus, number> = { shortfall: 0, partial: 1, confirmed: 2 }
      return rank[a.atpStatus] - rank[b.atpStatus]
    },
  },
  {
    key: 'netValue', header: 'Net Value', width: 116, mono: true,
    render: r => <span className="block w-full text-right font-mono tabular-nums">{usd(r.netValue)}</span>,
    sortFn: (a, b) => a.netValue - b.netValue,
  },
]

export function SalesOrdersModule({ erpData }: ErpModuleProps) {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const atp = useMemo(() => deriveAtp(erpData), [erpData])

  // Enrich each order with its derived ATP promise (memoized — pure over the snapshot).
  const orders = useMemo<AtpOrder[]>(() => {
    const short = atp.shortfall > 0
    return erpData.salesOrders.map(o => {
      const atpStatus = atpStatusFor(o, short)
      return { ...o, atpStatus, promisedDate: promisedDateFor(o, atpStatus) }
    })
  }, [erpData.salesOrders, atp.shortfall])

  const openCount = orders.filter(o => o.status === 'open').length
  const hotCount = orders.filter(o => o.priority === 'hot' || o.priority === 'super-hot').length
  const shortCount = orders.filter(o => o.atpStatus === 'shortfall').length

  const selectedRow =
    selectedEntity?.type === 'salesOrder'
      ? orders.find(o => o.orderNo === selectedEntity.id) ?? null
      : null

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[10px] text-accent">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
        {openCount} Open
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-critical">
        <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse-soft" aria-hidden />
        {hotCount} Expedited
      </span>
      {shortCount > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-critical/15 text-critical border border-critical/30">
          <AlertTriangle size={11} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="font-mono tabular-nums">{shortCount}</span> At Risk
        </span>
      )}
    </div>
  )

  const renderDetail = (row: AtpOrder) => {
    const slipped = row.promisedDate !== row.requestedDate
    return (
      <div className="space-y-5 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="Order No" value={row.orderNo} mono />
          <DetailField label="Customer" value={row.customerName} />
          <DetailField label="Customer No" value={row.bpNo} mono />
          <DetailField label="Order Date" value={row.orderDate} mono />
          <DetailField label="Requested" value={row.requestedDate} mono />
          <DetailField
            label="Promised"
            value={<span className={slipped ? 'text-warn' : undefined}>{row.promisedDate}</span>}
            mono
          />
          <DetailField label="Net Value" value={usd(row.netValue)} mono />
          <DetailField label="Status" value={<StatusCell status={row.status} />} />
          <DetailField label="Priority" value={<PriorityCell priority={row.priority} />} />
          <DetailField label="ATP" value={<AtpCell status={row.atpStatus} />} />
        </div>

        <section>
          <SectionTitle icon={<ListOrdered size={13} strokeWidth={1.9} />} text={`Line Items · ${row.lines.length}`} />
          <LineItems lines={row.lines} />
        </section>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader
            title="Sales Orders"
            subtitle={`${orders.length.toLocaleString()} orders`}
            icon={<ShoppingCart size={15} strokeWidth={1.9} />}
            right={headerRight}
          />
          <AtpAvailabilityPanel atp={atp} />
          <div className="flex-1 min-h-0">
            <DenseDataTable
              data={orders}
              columns={cols}
              rowKey={r => r.orderNo}
              onRowClick={row => selectEntity({ type: 'salesOrder', id: row.orderNo })}
              selectedKey={selectedEntity?.id ?? null}
              rowClassName={r =>
                r.atpStatus === 'shortfall' ? 'row-superhot' : r.atpStatus === 'partial' ? 'row-hot' : undefined
              }
            />
          </div>
        </Panel>
      </div>

      {selectedRow && (
        <DrillInPanel title={selectedRow.orderNo} subtitle={selectedRow.customerName}>
          {renderDetail(selectedRow)}
        </DrillInPanel>
      )}
    </div>
  )
}
