import { useEffect, useMemo, useRef, useState } from 'react'
import { ShoppingCart, PackageOpen, AlertTriangle, Truck, Inbox, PackageCheck } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { Heatbar } from '../../components/ui/Heatbar'
import { RankBar } from '../../components/ui/RankBar'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { brand, sem } from '../../lib/tokens'
import type { PurchaseOrder } from '../../data/erp/types'
import type { ErpModuleProps } from './types'
import { poPipeline, vendorOnTime, deliveryWindowDays } from './erpViz'

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

/** A single PO pipeline node with an AnimatedNumber count + glow ring. */
function PipelineNode({
  icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  pulse?: boolean
}) {
  return (
    <div className="relative flex flex-col items-center gap-1.5 px-3 shrink-0">
      <span
        className="relative flex items-center justify-center w-11 h-11 rounded-full border"
        style={{ borderColor: `${color}66`, background: `${color}14`, boxShadow: `0 0 16px -4px ${color}` }}
      >
        <span style={{ color }} className="flex items-center">{icon}</span>
        {pulse && (
          <span
            className="animate-sonar absolute inset-0 rounded-full border"
            style={{ borderColor: color }}
            aria-hidden
          />
        )}
      </span>
      <span className="metric-value text-[18px] font-semibold leading-none" style={{ color }}>
        <AnimatedNumber value={value} />
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</span>
    </div>
  )
}

/** Connecting gradient glow flow line between two pipeline nodes. */
function FlowLine({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex-1 h-px relative self-start mt-[22px] min-w-6">
      <div
        className="animate-shimmer absolute inset-0"
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
        aria-hidden
      />
    </div>
  )
}

export function ProcurementModule({ erpData, eventBus }: ErpModuleProps) {
  const purchaseOrders = erpData.purchaseOrders
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const lateCount = useMemo(
    () => purchaseOrders.reduce((n, po) => (po.status === 'late' ? n + 1 : n), 0),
    [purchaseOrders],
  )
  const pipeline = useMemo(() => poPipeline(purchaseOrders), [purchaseOrders])
  const vendors = useMemo(() => vendorOnTime(purchaseOrders).slice(0, 6), [purchaseOrders])
  const maxWindow = useMemo(
    () => purchaseOrders.reduce((m, po) => Math.max(m, deliveryWindowDays(po)), 1),
    [purchaseOrders],
  )
  const totalValue = useMemo(() => purchaseOrders.reduce((s, po) => s + po.netValue, 0), [purchaseOrders])

  // Pulse the Received node briefly whenever an erp.po.received event fires.
  const [receivedPulse, setReceivedPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const sub = eventBus.ofTopic('erp.po.received').subscribe(() => {
      setReceivedPulse(true)
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
      pulseTimer.current = setTimeout(() => setReceivedPulse(false), 2200)
    })
    return () => {
      sub.unsubscribe()
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [eventBus])

  const columns: Column<PurchaseOrder>[] = useMemo(() => [
    {
      key: 'poNo', header: 'PO No.', width: 150, mono: true,
      render: r => r.poNo,
      sortFn: (a, b) => a.poNo.localeCompare(b.poNo),
    },
    {
      key: 'vendorName', header: 'Vendor', width: 190, flex: true,
      render: r => r.vendorName,
      sortFn: (a, b) => a.vendorName.localeCompare(b.vendorName),
    },
    {
      key: 'status', header: 'Status', width: 130,
      render: r => <StatusChip status={r.status} />,
      sortFn: (a, b) => a.status.localeCompare(b.status),
    },
    {
      key: 'deliveryDate', header: 'Delivery', width: 116, mono: true,
      render: r => r.deliveryDate,
      sortFn: (a, b) => a.deliveryDate.localeCompare(b.deliveryDate),
    },
    {
      key: 'window', header: 'Lead Window', width: 150,
      render: r => {
        const days = deliveryWindowDays(r)
        return (
          <div className="flex items-center gap-2 w-full">
            <span className="font-mono tabular-nums text-[11px] text-ink-2 w-8 shrink-0 text-right">{days}d</span>
            <Heatbar value={days} max={maxWindow} tone={r.status === 'late' ? 'critical' : 'auto'} className="flex-1" />
          </div>
        )
      },
      sortFn: (a, b) => deliveryWindowDays(a) - deliveryWindowDays(b),
    },
    {
      key: 'netValue', header: 'Net Value', width: 120, mono: true,
      render: r => (
        <span className="block text-right font-mono tabular-nums text-ink-1">{USD.format(r.netValue)}</span>
      ),
      sortFn: (a, b) => a.netValue - b.netValue,
    },
  ], [maxWindow])

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

  const selectedRow =
    selectedEntity?.type === 'purchaseOrder'
      ? purchaseOrders.find(po => po.poNo === selectedEntity.id) ?? null
      : null

  const renderDetail = (po: PurchaseOrder) => (
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

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-bloom" aria-hidden />
      <div className="relative z-[1] flex flex-col flex-1 min-h-0 p-4 gap-3">
        <ModuleHeader
          domain="ERP"
          icon={<ShoppingCart size={13} strokeWidth={2} />}
          title="Procurement · Purchase Orders"
          subtitle={`${purchaseOrders.length.toLocaleString()} purchase orders`}
          pills={[
            { label: 'PO Value', value: <AnimatedNumber value={totalValue} format={n => USD.format(Math.round(n))} />, tone: 'accent' },
            { label: 'In Transit', value: <AnimatedNumber value={pipeline.inTransit} />, tone: 'info' },
            { label: 'Late', value: <AnimatedNumber value={lateCount} />, tone: lateCount > 0 ? 'critical' : 'success' },
          ]}
          right={headerRight}
        />

        {/* PO pipeline band + vendor on-time rank */}
        <div className="flex gap-3 shrink-0">
          <Panel className="flex-1 min-w-0 animate-rise overflow-hidden" style={{ animationDelay: '100ms' }} data-tour="procurement.pipeline">
            <PanelHeader
              title="PO Pipeline"
              subtitle="Open → In-Transit → Received"
              icon={<Truck size={15} strokeWidth={1.9} />}
            />
            <div className="flex items-center px-3 py-3">
              <PipelineNode icon={<Inbox size={18} strokeWidth={1.9} />} label="Open" value={pipeline.open} color={brand.primary} />
              <FlowLine from={brand.primary} to={brand.secondary} />
              <PipelineNode icon={<Truck size={18} strokeWidth={1.9} />} label="In Transit" value={pipeline.inTransit} color={brand.secondary} />
              <FlowLine from={brand.secondary} to={sem.success} />
              <PipelineNode
                icon={<PackageCheck size={18} strokeWidth={1.9} />}
                label="Received"
                value={pipeline.received}
                color={sem.success}
                pulse={receivedPulse}
              />
            </div>
          </Panel>

          <Panel className="w-[300px] shrink-0 animate-rise overflow-hidden hidden lg:block p-3" style={{ animationDelay: '160ms' }}>
            <SectionTitle icon={<Truck size={13} strokeWidth={1.9} />} text="Vendor On-Time" />
            <div className="mt-2.5">
              <RankBar items={vendors} max={100} tone="auto" formatValue={n => `${n}%`} />
            </div>
          </Panel>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 animate-rise" style={{ animationDelay: '200ms' }}>
            <Panel className="flex flex-col h-full overflow-hidden" data-tour="procurement.table">
              <PanelHeader
                title="Purchase Orders"
                subtitle="Lead-window pressure · late POs flag hot"
                icon={<ShoppingCart size={15} strokeWidth={1.9} />}
              />
              <div className="flex-1 min-h-0">
                <DenseDataTable
                  data={purchaseOrders}
                  columns={columns}
                  rowKey={r => r.poNo}
                  onRowClick={row => selectEntity({ type: 'purchaseOrder', id: row.poNo })}
                  selectedKey={selectedEntity?.id ?? null}
                  rowClassName={r => (r.status === 'late' ? 'row-hot' : undefined)}
                />
              </div>
            </Panel>
          </div>

          {selectedRow && (
            <DrillInPanel title={selectedRow.poNo} subtitle={selectedRow.vendorName}>
              {renderDetail(selectedRow)}
            </DrillInPanel>
          )}
        </div>
      </div>
    </div>
  )
}
