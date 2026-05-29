import { ShoppingCart, ListOrdered } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import { cn } from '../../lib/utils'
import type { SalesOrder, SalesOrderLine, OrderStatus } from '../../data/erp/types'
import type { ErpModuleProps } from './types'

/** USD formatter for net values — deterministic, no locale wall-clock surprises. */
const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

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

const cols: Column<SalesOrder>[] = [
  {
    key: 'orderNo', header: 'Order No', width: 130, mono: true,
    render: r => r.orderNo,
    sortFn: (a, b) => a.orderNo.localeCompare(b.orderNo),
  },
  {
    key: 'customerName', header: 'Customer', width: 180,
    render: r => r.customerName,
    sortFn: (a, b) => a.customerName.localeCompare(b.customerName),
  },
  {
    key: 'status', header: 'Status', width: 120,
    render: r => <StatusCell status={r.status} />,
    sortFn: (a, b) => a.status.localeCompare(b.status),
  },
  {
    key: 'priority', header: 'Priority', width: 110,
    render: r => <PriorityCell priority={r.priority} />,
    sortFn: (a, b) => {
      const rank: Record<SalesOrder['priority'], number> = { 'super-hot': 0, hot: 1, normal: 2 }
      return rank[a.priority] - rank[b.priority]
    },
  },
  {
    key: 'requestedDate', header: 'Requested', width: 120, mono: true,
    render: r => r.requestedDate,
    sortFn: (a, b) => a.requestedDate.localeCompare(b.requestedDate),
  },
  {
    key: 'netValue', header: 'Net Value', width: 120, mono: true,
    render: r => <span className="block w-full text-right font-mono tabular-nums">{usd(r.netValue)}</span>,
    sortFn: (a, b) => a.netValue - b.netValue,
  },
]

export function SalesOrdersModule({ erpData }: ErpModuleProps) {
  const orders = erpData.salesOrders

  const openCount = orders.filter(o => o.status === 'open').length
  const hotCount = orders.filter(o => o.priority === 'hot' || o.priority === 'super-hot').length

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
    </div>
  )

  const renderDetail = (row: SalesOrder) => (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <DetailField label="Order No" value={row.orderNo} mono />
        <DetailField label="Customer" value={row.customerName} />
        <DetailField label="Customer No" value={row.bpNo} mono />
        <DetailField label="Order Date" value={row.orderDate} mono />
        <DetailField label="Requested" value={row.requestedDate} mono />
        <DetailField label="Net Value" value={usd(row.netValue)} mono />
        <DetailField label="Status" value={<StatusCell status={row.status} />} />
        <DetailField label="Priority" value={<PriorityCell priority={row.priority} />} />
      </div>

      <section>
        <SectionTitle icon={<ListOrdered size={13} strokeWidth={1.9} />} text={`Line Items · ${row.lines.length}`} />
        <LineItems lines={row.lines} />
      </section>
    </div>
  )

  return (
    <MasterDataModule
      title="Sales Orders"
      subtitle={`${orders.length.toLocaleString()} orders`}
      icon={<ShoppingCart size={15} strokeWidth={1.9} />}
      data={orders}
      columns={cols}
      rowKey={r => r.orderNo}
      entityType="salesOrder"
      headerRight={headerRight}
      renderDetail={renderDetail}
      detailTitle={r => r.orderNo}
      detailSubtitle={r => r.customerName}
    />
  )
}
