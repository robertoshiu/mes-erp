import { useMemo } from 'react'
import { Factory, Radio, Link2, Activity, GanttChartSquare } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { useBridgedLots } from '../../lib/useBridgedLots'
import type { ProductionOrder, ProdOrderStatus, BridgedLot } from '../../data/erp/types'
import type { ErpModuleProps } from './types'
import { buildGantt, TODAY_REF, type GanttBar } from './prodTimeline'

/** Status-toned fill + glow for the Gantt bars and kanban chips. */
const STATUS_VIZ: Record<ProdOrderStatus, { fill: string; glow: string; label: string }> = {
  Created: { fill: '#4C5A74', glow: 'rgba(76, 90, 116, 0.5)', label: 'Created' },
  Released: { fill: '#38BDF8', glow: 'rgba(56, 189, 248, 0.5)', label: 'Released' },
  InProcess: { fill: '#22D3EE', glow: 'rgba(34, 211, 238, 0.6)', label: 'In-Process' },
  Completed: { fill: '#34D399', glow: 'rgba(52, 211, 153, 0.5)', label: 'Completed' },
}

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
  const selectEntity = useUiStore((s) => s.selectEntity)
  const selectedEntity = useUiStore((s) => s.selectedEntity)
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

  // Hero Gantt model — deterministic timeline derived from order status + hash.
  const gantt = useMemo(() => buildGantt(orders, 14), [orders])

  const selectedOrderNo =
    selectedEntity?.type === 'prodOrder' ? selectedEntity.id : null
  const selectedRow = useMemo(
    () => (selectedOrderNo ? orders.find((o) => o.orderNo === selectedOrderNo) ?? null : null),
    [orders, selectedOrderNo],
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
    <div className="flex h-full">
      <div className="relative flex-1 min-w-0 flex flex-col p-4 gap-3 overflow-hidden">
        <div className="bg-bloom" aria-hidden />

        <div className="relative z-[1] animate-rise" style={{ animationDelay: '0ms' }}>
          <ModuleHeader
            title="Production Orders"
            subtitle={`${orders.length.toLocaleString()} orders · ${inFlight} live on floor`}
            domain="ERP"
            icon={<Factory size={13} strokeWidth={2} />}
            pills={[
              { label: 'In-Process', value: <AnimatedNumber value={statusCounts.InProcess} />, tone: 'accent' },
              { label: 'Released', value: <AnimatedNumber value={statusCounts.Released} />, tone: 'info' },
              { label: 'On Floor', value: <AnimatedNumber value={inFlight} />, tone: 'success' },
            ]}
            right={headerRight}
          />
        </div>

        {/* Hero order-timeline (Gantt) + status mini-kanban */}
        <div className="relative z-[1] grid gap-3 animate-rise" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(200px, auto)', animationDelay: '60ms' }}>
          <GanttStrip
            bars={gantt}
            selectedNo={selectedOrderNo}
            onSelect={(no) => selectEntity({ type: 'prodOrder', id: no })}
          />
          <Kanban counts={statusCounts} inFlight={inFlight} />
        </div>

        <Panel className="relative z-[1] flex flex-col flex-1 min-h-0 overflow-hidden animate-rise" style={{ animationDelay: '120ms' }} data-tour="production-orders.table">
          <PanelHeader
            title="Order Book"
            subtitle={`${orders.length.toLocaleString()} orders`}
            icon={<Factory size={15} strokeWidth={1.9} />}
          />
          <div className="flex-1 min-h-0">
            <DenseDataTable
              data={orders}
              columns={columns}
              rowKey={(r) => r.orderNo}
              onRowClick={(row) => selectEntity({ type: 'prodOrder', id: row.orderNo })}
              selectedKey={selectedEntity?.id ?? null}
            />
          </div>
        </Panel>
      </div>

      {selectedRow && (
        <DrillInPanel title={selectedRow.orderNo} subtitle={selectedRow.description}>
          {renderDetail(selectedRow)}
        </DrillInPanel>
      )}
    </div>
  )
}

/* ===========================================================================
   Hero order-timeline strip (pure-SVG Gantt). One bar per order on a 0..1 time
   axis derived deterministically from order status (see prodTimeline.ts), a
   "today" reference line, status-toned fills, and a glow on the selected order.
   Clicking a bar selects the order (same uiStore selection as the table rows).
   =========================================================================== */
function GanttStrip({
  bars,
  selectedNo,
  onSelect,
}: {
  bars: GanttBar[]
  selectedNo: string | null
  onSelect: (orderNo: string) => void
}) {
  const rowH = 13
  const gap = 3
  const padX = 4
  const innerW = 100 - padX * 2 // viewBox is 0..100 horizontally
  const height = Math.max(1, bars.length) * (rowH + gap)
  return (
    <Panel className="overflow-hidden" data-tour="production-orders.gantt">
      <PanelHeader
        title="Order Timeline"
        subtitle="Scheduled run windows · status-toned"
        icon={<GanttChartSquare size={14} strokeWidth={1.9} />}
        right={
          <span className="hidden lg:flex items-center gap-2.5 text-[9px] uppercase tracking-[0.12em] text-ink-3">
            {(['InProcess', 'Released', 'Created', 'Completed'] as ProdOrderStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px]" style={{ background: STATUS_VIZ[s].fill }} aria-hidden />
                {STATUS_VIZ[s].label}
              </span>
            ))}
          </span>
        }
      />
      <div className="p-2.5">
        {bars.length === 0 ? (
          <div className="px-1 py-3 text-[11px] text-ink-3">No production orders to schedule.</div>
        ) : (
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Production order timeline"
          >
            {/* Today reference line */}
            <line
              x1={padX + TODAY_REF * innerW}
              y1={0}
              x2={padX + TODAY_REF * innerW}
              y2={height}
              stroke="rgba(34, 211, 238, 0.55)"
              strokeWidth={0.5}
              strokeDasharray="1.4 1.4"
            />
            {bars.map((bar, i) => {
              const viz = STATUS_VIZ[bar.status]
              const x = padX + bar.start * innerW
              const w = Math.max(1, (bar.end - bar.start) * innerW)
              const y = i * (rowH + gap)
              const isSel = bar.orderNo === selectedNo
              return (
                <g key={bar.orderNo} className="cursor-pointer" onClick={() => onSelect(bar.orderNo)}>
                  {/* Hover/click hit area spans the full row width */}
                  <rect x={0} y={y} width={100} height={rowH} fill="transparent" />
                  <rect
                    x={x}
                    y={y + 2}
                    width={w}
                    height={rowH - 4}
                    rx={1.5}
                    fill={viz.fill}
                    fillOpacity={isSel ? 1 : 0.82}
                    stroke={isSel ? '#fff' : 'transparent'}
                    strokeWidth={isSel ? 0.5 : 0}
                    style={{ filter: isSel ? `drop-shadow(0 0 3px ${viz.glow})` : undefined }}
                  >
                    <title>{`${bar.orderNo} · ${viz.label}`}</title>
                  </rect>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </Panel>
  )
}

/** Status mini-kanban: per-status count chips with animated count-ups. */
function Kanban({
  counts,
  inFlight,
}: {
  counts: Record<ProdOrderStatus, number>
  inFlight: number
}) {
  const lanes: { status: ProdOrderStatus; n: number }[] = [
    { status: 'Created', n: counts.Created },
    { status: 'Released', n: counts.Released },
    { status: 'InProcess', n: counts.InProcess },
    { status: 'Completed', n: counts.Completed },
  ]
  return (
    <Panel className="overflow-hidden flex flex-col">
      <PanelHeader title="Status Board" icon={<Radio size={14} strokeWidth={1.9} />} />
      <div className="p-2.5 grid grid-cols-2 gap-2 flex-1">
        {lanes.map(({ status, n }) => {
          const viz = STATUS_VIZ[status]
          return (
            <div
              key={status}
              className="rounded-md border border-edge bg-surface-3/30 px-2.5 py-2 flex flex-col gap-1"
              style={{ boxShadow: `inset 2px 0 0 ${viz.fill}` }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3 inline-flex items-center gap-1.5">
                <span
                  className={cn('w-1.5 h-1.5 rounded-full', status === 'InProcess' && 'animate-pulse-soft')}
                  style={{ background: viz.fill, boxShadow: `0 0 6px ${viz.glow}` }}
                  aria-hidden
                />
                {viz.label}
              </span>
              <span className="metric-value text-[18px] font-semibold text-ink-1 leading-none">
                <AnimatedNumber value={n} />
              </span>
            </div>
          )
        })}
      </div>
      <div className="px-2.5 pb-2 -mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3">
        <Radio size={12} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
        <span className="font-mono metric-value text-ink-1">
          <AnimatedNumber value={inFlight} />
        </span>
        <span className="uppercase tracking-[0.12em]">MES-bridged lots live</span>
      </div>
    </Panel>
  )
}
