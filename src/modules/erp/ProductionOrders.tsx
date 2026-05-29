import { useMemo } from 'react'
import { Factory, Radio, Link2, Activity } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import { cn } from '../../lib/utils'
import { useBridgedLots } from '../../lib/useBridgedLots'
import type { ProductionOrder, ProdOrderStatus, BridgedLot } from '../../data/erp/types'
import type { ErpModuleProps } from './types'

/** Status chip styled per ProdOrderStatus. InProcess pulses on accent. */
function StatusCell({ status }: { status: ProdOrderStatus }) {
  const map: Record<
    ProdOrderStatus,
    { label: string; cls: string; dot: string; pulse?: boolean }
  > = {
    Created: {
      label: 'Created',
      cls: 'bg-surface-3 text-ink-3 border border-edge',
      dot: 'bg-ink-mute',
    },
    Released: {
      label: 'Released',
      cls: 'bg-accent-2/15 text-accent-2 border border-accent-2/30',
      dot: 'bg-accent-2',
    },
    InProcess: {
      label: 'In-Process',
      cls: 'bg-accent/15 text-accent border border-accent/30 animate-pulse-soft',
      dot: 'bg-accent',
      pulse: true,
    },
    Completed: {
      label: 'Completed',
      cls: 'bg-success/15 text-success border border-success/30',
      dot: 'bg-success',
    },
  }
  const s = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm',
        s.cls,
      )}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot, s.pulse && 'animate-pulse-soft')}
        aria-hidden
      />
      {s.label}
    </span>
  )
}

/** Glowing LIVE badge + progress track (reuses Production's ProgressCell style). */
function LiveProgressCell({ lot }: { lot: BridgedLot }) {
  const pct = lot.totalSteps > 0 ? (lot.currentStep / lot.totalSteps) * 100 : 0
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent shrink-0">
        <span className="relative inline-flex w-1.5 h-1.5 shrink-0" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="animate-sonar absolute inset-0 rounded-full border border-accent" />
        </span>
        Live
      </span>
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden min-w-[40px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(34, 211, 238, 0.55)' }}
        />
      </div>
      <span className="text-[10px] text-ink-3 font-mono tabular-nums shrink-0">
        {lot.currentStep}/{lot.totalSteps}
      </span>
    </div>
  )
}

/** Label/value pair in the drill-in detail grid (matches Production's DetailField). */
function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
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

export function ProductionOrdersModule({ erpData, eventBus: _eventBus }: ErpModuleProps) {
  const bridged = useBridgedLots((s) => s.lots)

  // Index bridged lots by their production order number for O(1) lookup.
  const lotByOrder = useMemo(() => {
    const m = new Map<string, BridgedLot>()
    for (const lot of bridged) m.set(lot.prodOrderNo, lot)
    return m
  }, [bridged])

  const orders = erpData.productionOrders

  // Status counts for the header summary.
  const statusCounts = useMemo(() => {
    const c: Record<ProdOrderStatus, number> = {
      Created: 0,
      Released: 0,
      InProcess: 0,
      Completed: 0,
    }
    for (const o of orders) c[o.status] += 1
    return c
  }, [orders])

  // Live count: bridged lots still in flight (not yet complete).
  const inFlight = useMemo(
    () => bridged.filter((l) => l.status !== 'complete').length,
    [bridged],
  )

  const columns: Column<ProductionOrder>[] = useMemo(
    () => [
      {
        key: 'orderNo',
        header: 'Order No',
        width: 150,
        mono: true,
        render: (r) => r.orderNo,
        sortFn: (a, b) => a.orderNo.localeCompare(b.orderNo),
      },
      {
        key: 'description',
        header: 'Description',
        width: 200,
        render: (r) => r.description,
        sortFn: (a, b) => a.description.localeCompare(b.description),
      },
      {
        key: 'routeId',
        header: 'Route',
        width: 110,
        mono: true,
        render: (r) => r.routeId,
        sortFn: (a, b) => a.routeId.localeCompare(b.routeId),
      },
      {
        key: 'targetQty',
        header: 'Target Qty',
        width: 90,
        mono: true,
        render: (r) => (
          <span className="font-mono tabular-nums">{r.targetQty.toLocaleString()}</span>
        ),
        sortFn: (a, b) => a.targetQty - b.targetQty,
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (r) => <StatusCell status={r.status} />,
      },
      {
        key: 'live',
        header: 'Live Progress',
        width: 180,
        render: (r) => {
          const lot = lotByOrder.get(r.orderNo)
          if (!lot) return <span className="text-[11px] text-ink-3" aria-label="not on floor">&mdash;</span>
          return <LiveProgressCell lot={lot} />
        },
      },
    ],
    [lotByOrder],
  )

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-mute" aria-hidden />
        Created <span className="font-mono text-ink-2">{statusCounts.Created}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-accent-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-2" aria-hidden />
        Released <span className="font-mono">{statusCounts.Released}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-accent">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" aria-hidden />
        In-Process <span className="font-mono">{statusCounts.InProcess}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
        Completed <span className="font-mono">{statusCounts.Completed}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-ink-3 pl-2 border-l border-edge">
        <Radio size={13} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
        <span className="font-mono metric-value text-ink-1">{inFlight}</span>
        <span className="uppercase tracking-[0.12em]">in flight</span>
      </span>
    </div>
  )

  const renderDetail = (row: ProductionOrder) => {
    const lot = lotByOrder.get(row.orderNo)
    const pct = lot && lot.totalSteps > 0 ? (lot.currentStep / lot.totalSteps) * 100 : 0
    return (
      <div className="space-y-5 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="Order No" value={row.orderNo} mono />
          <DetailField label="Status" value={<StatusCell status={row.status} />} />
          <DetailField label="Material" value={row.materialNo} mono />
          <DetailField label="Route" value={row.routeId} mono />
          <DetailField label="Target Qty" value={row.targetQty.toLocaleString()} mono />
          <DetailField label="Lot ID" value={row.lotId ?? '—'} mono />
          <div className="col-span-2">
            <DetailField label="Description" value={row.description} />
          </div>
        </div>

        <section>
          <SectionTitle icon={<Link2 size={13} strokeWidth={1.9} />} text="Linked Sales Order" />
          <div className="mt-2">
            {row.salesOrderNo ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-accent px-2 py-1 rounded-md bg-accent/10 border border-edge">
                {row.salesOrderNo}
              </span>
            ) : (
              <span className="text-ink-3 text-[11px]">Make-to-stock — no linked sales order</span>
            )}
          </div>
        </section>

        {lot && (
          <section>
            <SectionTitle icon={<Activity size={13} strokeWidth={1.9} />} text="Live Floor Progress" />
            <div className="mt-2 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="relative inline-flex w-1.5 h-1.5 shrink-0" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="animate-sonar absolute inset-0 rounded-full border border-accent" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent text-glow-soft">
                  Live on the fab floor
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <DetailField label="Lot" value={lot.lotId} mono />
                <DetailField label="Product" value={lot.productCode} mono />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
                    style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(34, 211, 238, 0.55)' }}
                  />
                </div>
                <span className="text-[10px] text-ink-3 font-mono tabular-nums shrink-0">
                  {lot.currentStep}/{lot.totalSteps}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <MasterDataModule
      title="Production Orders"
      subtitle={`${orders.length.toLocaleString()} orders · ${inFlight} live on floor`}
      icon={<Factory size={15} strokeWidth={1.9} />}
      data={orders}
      columns={columns}
      rowKey={(r) => r.orderNo}
      entityType="prodOrder"
      headerRight={headerRight}
      renderDetail={renderDetail}
      detailTitle={(r) => r.orderNo}
      detailSubtitle={(r) => r.description}
    />
  )
}
