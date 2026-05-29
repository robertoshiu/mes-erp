import { ShoppingCart, PackageOpen, AlertTriangle } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import { cn } from '../../lib/utils'
import type { PurchaseOrder } from '../../data/erp/types'
import type { ErpModuleProps } from './types'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

type PoStatus = PurchaseOrder['status']

/** Visual treatment per PO status. `late` pulses critical to draw the eye. */
const STATUS_META: Record<PoStatus, { label: string; className: string; dot: string; pulse?: boolean }> = {
  open: { label: 'Open', className: 'bg-accent/15 text-accent border border-accent/30', dot: 'bg-accent' },
  confirmed: { label: 'Confirmed', className: 'bg-accent-2/15 text-accent-2 border border-accent-2/30', dot: 'bg-accent-2' },
  received: { label: 'Received', className: 'bg-success/15 text-success border border-success/30', dot: 'bg-success' },
  late: { label: 'Late', className: 'bg-critical text-white animate-pulse-soft', dot: 'bg-critical', pulse: true },
}

/** Status chip mirroring the Production drill-in chip language. */
function StatusChip({ status }: { status: PoStatus }) {
  const s = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm',
        s.className,
      )}
    >
      {s.pulse ? (
        <span className="relative inline-flex w-1.5 h-1.5 shrink-0" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-critical" />
          <span className="animate-sonar absolute inset-0 rounded-full border border-critical" />
        </span>
      ) : (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} aria-hidden />
      )}
      {s.label}
    </span>
  )
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

const columns: Column<PurchaseOrder>[] = [
  {
    key: 'poNo', header: 'PO No.', width: 150, mono: true,
    render: r => r.poNo,
    sortFn: (a, b) => a.poNo.localeCompare(b.poNo),
  },
  {
    key: 'vendorName', header: 'Vendor', width: 200,
    render: r => r.vendorName,
    sortFn: (a, b) => a.vendorName.localeCompare(b.vendorName),
  },
  {
    key: 'status', header: 'Status', width: 130,
    render: r => <StatusChip status={r.status} />,
    sortFn: (a, b) => a.status.localeCompare(b.status),
  },
  {
    key: 'deliveryDate', header: 'Delivery', width: 120, mono: true,
    render: r => r.deliveryDate,
    sortFn: (a, b) => a.deliveryDate.localeCompare(b.deliveryDate),
  },
  {
    key: 'netValue', header: 'Net Value', width: 120, mono: true,
    render: r => (
      <span className="block text-right font-mono tabular-nums text-ink-1">{USD.format(r.netValue)}</span>
    ),
    sortFn: (a, b) => a.netValue - b.netValue,
  },
]

function renderDetail(po: PurchaseOrder) {
  return (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <DetailField label="PO No." value={po.poNo} mono />
        <DetailField label="Vendor" value={po.vendorName} />
        <DetailField label="Status" value={<StatusChip status={po.status} />} />
        <DetailField label="Net Value" value={USD.format(po.netValue)} mono />
        <DetailField label="Order Date" value={po.orderDate} mono />
        <DetailField label="Delivery Date" value={po.deliveryDate} mono />
      </div>

      <section>
        <SectionTitle icon={<PackageOpen size={13} strokeWidth={1.9} />} text={`Line Items · ${po.lines.length}`} />
        <div className="mt-2 rounded-md border border-edge overflow-hidden">
          {po.lines.map(line => (
            <div
              key={line.lineNo}
              className="flex items-center gap-2.5 py-1.5 pl-3 pr-2.5 border-b border-edge last:border-b-0 hover:bg-surface-3/50 transition-colors"
            >
              <span className="w-5 text-center font-mono tabular-nums text-[11px] text-ink-3 shrink-0">{line.lineNo}</span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-ink-2 truncate">{line.materialNo}</div>
                <div className="text-ink-3 text-[10px] truncate">{line.description}</div>
              </div>
              <span className="font-mono tabular-nums text-[11px] text-ink-2 shrink-0 w-16 text-right">{line.qty}</span>
              <span className="font-mono tabular-nums text-[11px] text-ink-1 shrink-0 w-20 text-right">{USD.format(line.netPrice)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function ProcurementModule({ erpData }: ErpModuleProps) {
  const purchaseOrders = erpData.purchaseOrders
  const lateCount = purchaseOrders.reduce((n, po) => (po.status === 'late' ? n + 1 : n), 0)

  const headerRight =
    lateCount > 0 ? (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-critical/15 text-critical border border-critical/30">
        <AlertTriangle size={12} strokeWidth={2} className="shrink-0" />
        <span className="font-mono tabular-nums">{lateCount}</span> Late
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
        On schedule
      </span>
    )

  return (
    <MasterDataModule<PurchaseOrder>
      title="Procurement · Purchase Orders"
      subtitle={`${purchaseOrders.length.toLocaleString()} purchase orders`}
      icon={<ShoppingCart size={15} strokeWidth={1.9} />}
      data={purchaseOrders}
      columns={columns}
      rowKey={r => r.poNo}
      entityType="purchaseOrder"
      headerRight={headerRight}
      renderDetail={renderDetail}
      detailTitle={r => r.poNo}
      detailSubtitle={r => r.vendorName}
    />
  )
}
