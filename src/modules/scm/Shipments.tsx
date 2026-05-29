import { useEffect, useMemo, useReducer, useState } from 'react'
import { Ship, Plane, Truck, ArrowRight, PackageCheck, Radio } from 'lucide-react'
import type { ReactNode } from 'react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { useShipments } from '../../lib/useShipments'
import { shipmentPosition } from '../../data/scm/shipmentPosition'
import { LOOP_DURATION_S } from '../../lib/clock'
import { cn } from '../../lib/utils'
import type { ScmModuleProps } from './types'
import type {
  Shipment,
  ShipmentStatus,
  LaneMode,
  NetworkNode,
  Lane,
} from '../../data/scm/types'

/* ──────────────────────────────────────────────────────────────────────────
 * Shipments / In-Transit — the live logistics table (plan Visual Design Spec D).
 * One row per shipment the SCM shipment-driver puts in flight (read live from the
 * shared useShipments store). Status reuses the Cockpit DocChip/LaneTone glow-ring
 * tone map; the in-transit progress bar reuses the Cockpit LotProgress
 * from-accent-2 to-accent gradient rail — progress is COMPUTED from
 * shipmentPosition(loopT, departureT, transitSeconds) per ARCH-1, never a stored
 * field. row-hot flags late shipments, row-superhot flags disruption-affected ones.
 * ────────────────────────────────────────────────────────────────────────── */

/** Tone map reused from the Cockpit DocChip/LaneTone glow rings (plan Spec D):
 *  created → ink-3, in-transit → accent-2 (+ pulse-soft), arrived/delivered → success. */
type ChipTone = 'ink-3' | 'accent-2' | 'success'

const STATUS_TONE: Record<ShipmentStatus, { tone: ChipTone; label: string }> = {
  created: { tone: 'ink-3', label: 'Created' },
  'in-transit': { tone: 'accent-2', label: 'In Transit' },
  arrived: { tone: 'success', label: 'Arrived' },
  delivered: { tone: 'success', label: 'Delivered' },
}

const TONE: Record<ChipTone, { text: string; dot: string; chip: string; glow: string }> = {
  'ink-3': {
    text: 'text-ink-3',
    dot: 'bg-ink-mute',
    chip: 'border-edge bg-surface-3/50',
    glow: 'rgba(148, 163, 184, 0.5)',
  },
  'accent-2': {
    text: 'text-accent-2',
    dot: 'bg-accent-2',
    chip: 'border-accent-2/30 bg-accent-2/10',
    glow: 'rgba(45, 212, 191, 0.6)',
  },
  success: {
    text: 'text-success',
    dot: 'bg-success',
    chip: 'border-success/30 bg-success/10',
    glow: 'rgba(52, 211, 153, 0.6)',
  },
}

/** Lane-mode glyph for the from→to / transit context (texture, never a net-new hue). */
const MODE_ICON: Record<LaneMode, ReactNode> = {
  air: <Plane size={11} strokeWidth={1.9} />,
  sea: <Ship size={11} strokeWidth={1.9} />,
  truck: <Truck size={11} strokeWidth={1.9} />,
}

/** Status chip reusing the DocChip glow-ring tone map. in-transit breathes. */
function StatusChip({ status }: { status: ShipmentStatus }) {
  const { tone, label } = STATUS_TONE[status]
  const t = TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        t.chip,
        t.text,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot, status === 'in-transit' && 'animate-pulse-soft')}
        style={{ boxShadow: `0 0 6px ${t.glow}` }}
        aria-hidden
      />
      {label}
    </span>
  )
}

/** In-transit progress rail — reuses the Cockpit LotProgress from-accent-2 to-accent
 *  gradient. `pos` is the computed shipmentPosition (0..1), NOT a stored field. */
function ShipProgress({ pos, status }: { pos: number; status: ShipmentStatus }) {
  const done = status === 'arrived' || status === 'delivered'
  const pct = done ? 100 : Math.round(pos * 100)
  return (
    <div className="flex w-full items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(45, 212, 191, 0.55)' }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-ink-3">{pct}%</span>
    </div>
  )
}

/** Warm empty state (LaneEmpty style — reuses the Cockpit vocabulary). */
function ShipmentsEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3/60 text-accent-2">
        <Radio size={16} strokeWidth={1.9} className="animate-pulse-soft" />
      </span>
      <p className="text-[11px] leading-snug text-ink-3">
        No shipments in transit — inbound PO and outbound lot legs appear live.
      </p>
    </div>
  )
}

/** Label/value pair in the drill-in detail grid (mirrors the ERP modules' drill-in). */
function DetailField({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className={cn('truncate text-ink-1', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

function SectionTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      <span className="flex items-center text-accent-3">{icon}</span>
      {text}
    </div>
  )
}

/* ── Live loop time ─────────────────────────────────────────────────────────
 * The Control Tower owns the rAF dot animation; this table only needs a 1s-cadence
 * live position for the progress bar / ETA / late flag, so it polls like TopBar.
 * The shared clock is not in ScmModuleProps, so loopT is reconstructed from the
 * same performance.now() timeline the clock runs on (loop-relative seconds). */
function useLoopT(): number {
  const [t, setT] = useState(() => (performance.now() / 1000) % LOOP_DURATION_S)
  useEffect(() => {
    const id = setInterval(() => setT((performance.now() / 1000) % LOOP_DURATION_S), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

/* ── Disruption-affected lanes (row-superhot) ────────────────────────────────
 * Track raised/cleared disruptions off the bus so rows on an affected lane flag
 * row-superhot. A small set keyed by laneId, mirroring the App badge effect. */
type DisruptionAction =
  | { kind: 'raise'; laneId: string }
  | { kind: 'clear'; laneId: string }

function disruptionReducer(state: Set<string>, action: DisruptionAction): Set<string> {
  const next = new Set(state)
  if (action.kind === 'raise') next.add(action.laneId)
  else next.delete(action.laneId)
  return next
}

/* ── Dense-table + drill-in shell ────────────────────────────────────────────
 * Same composition as MasterDataModule (DenseDataTable + DrillInPanel, selection
 * via the shared uiStore), inlined here only to forward `rowClassName` — which
 * MasterDataModule does not expose — so late rows flash row-hot and
 * disruption-affected rows flash row-superhot (plan Spec D). No new primitives. */
function ShipmentsTable({
  data,
  columns,
  rowClassName,
  headerRight,
  subtitle,
  renderDetail,
  detailSubtitle,
}: {
  data: Shipment[]
  columns: Column<Shipment>[]
  rowClassName: (row: Shipment) => string | undefined
  headerRight: ReactNode
  subtitle: string
  renderDetail: (row: Shipment) => ReactNode
  detailSubtitle: (row: Shipment) => string
}) {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const selectedRow =
    selectedEntity?.type === 'shipment'
      ? data.find(r => r.shipmentNo === selectedEntity.id) ?? null
      : null

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 p-4">
        <Panel className="flex h-full flex-col overflow-hidden">
          <PanelHeader
            title="Shipments / In-Transit"
            subtitle={subtitle}
            icon={<Ship size={15} strokeWidth={1.9} />}
            right={headerRight}
          />
          <div className="min-h-0 flex-1">
            <DenseDataTable
              data={data}
              columns={columns}
              rowKey={r => r.shipmentNo}
              onRowClick={r => selectEntity({ type: 'shipment', id: r.shipmentNo })}
              selectedKey={selectedEntity?.id ?? null}
              rowClassName={rowClassName}
            />
          </div>
        </Panel>
      </div>

      {selectedRow && (
        <DrillInPanel title={selectedRow.shipmentNo} subtitle={detailSubtitle(selectedRow)}>
          {renderDetail(selectedRow)}
        </DrillInPanel>
      )}
    </div>
  )
}

/** ETA label: in-transit → remaining loop-seconds; terminal → its outcome. */
function etaLabel(s: Shipment, pos: number, loopT: number): string {
  if (s.status === 'arrived') return 'Arrived'
  if (s.status === 'delivered') return 'Delivered'
  if (s.status === 'created') return 'Pending'
  if (pos >= 1) return 'Due'
  const remaining = Math.max(0, s.departureT + s.transitSeconds - loopT)
  return `${Math.ceil(remaining)}s`
}

export function ShipmentsModule({ scmData, eventBus }: ScmModuleProps) {
  const { networkNodes, lanes } = scmData
  const shipments = useShipments(s => s.shipments)
  const loopT = useLoopT()

  const [disruptedLanes, dispatchDisruption] = useReducer(disruptionReducer, undefined, () => new Set<string>())

  // Stable lookups for from→to labels + lane mode (texture cue per leg).
  const nodeById = useMemo(() => {
    const m = new Map<string, NetworkNode>()
    for (const n of networkNodes) m.set(n.id, n)
    return m
  }, [networkNodes])
  const laneById = useMemo(() => {
    const m = new Map<string, Lane>()
    for (const l of lanes) m.set(l.id, l)
    return m
  }, [lanes])

  const nodeName = (id: string) => nodeById.get(id)?.name ?? id

  useEffect(() => {
    const subs = [
      eventBus.ofTopic('scm.disruption.raised').subscribe(e =>
        dispatchDisruption({ kind: 'raise', laneId: e.laneId }),
      ),
      eventBus.ofTopic('scm.disruption.cleared').subscribe(e =>
        dispatchDisruption({ kind: 'clear', laneId: e.laneId }),
      ),
    ]
    return () => {
      for (const s of subs) s.unsubscribe()
    }
  }, [eventBus])

  // Live per-shipment position (computed, ARCH-1) — keyed by shipmentNo so the
  // columns + drill-in + rowClassName all read one consistent value per render.
  const posByShipment = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of shipments) m.set(s.shipmentNo, shipmentPosition(loopT, s.departureT, s.transitSeconds))
    return m
  }, [shipments, loopT])

  const inTransit = shipments.filter(s => s.status === 'in-transit').length
  const lateCount = shipments.filter(
    s => s.status === 'in-transit' && (posByShipment.get(s.shipmentNo) ?? 0) >= 1,
  ).length

  const columns: Column<Shipment>[] = useMemo(() => [
    {
      key: 'shipmentNo', header: 'Shipment', width: 120, mono: true,
      render: r => r.shipmentNo,
      sortFn: (a, b) => a.shipmentNo.localeCompare(b.shipmentNo),
    },
    {
      key: 'direction', header: 'Dir', width: 92,
      render: r => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
            r.direction === 'inbound' ? 'text-accent-2' : 'text-accent',
          )}
        >
          <ArrowRight
            size={11}
            strokeWidth={2.2}
            className={cn('shrink-0', r.direction === 'inbound' && 'rotate-180')}
            aria-hidden
          />
          {r.direction === 'inbound' ? 'In' : 'Out'}
        </span>
      ),
      sortFn: (a, b) => a.direction.localeCompare(b.direction),
    },
    {
      key: 'route', header: 'From → To', width: 240,
      render: r => {
        const lane = laneById.get(r.laneId)
        return (
          <span className="flex items-center gap-1.5 text-ink-2">
            {lane && <span className="shrink-0 text-ink-3">{MODE_ICON[lane.mode]}</span>}
            <span className="truncate">{nodeName(r.fromNode)}</span>
            <ArrowRight size={11} strokeWidth={2} className="shrink-0 text-ink-mute" aria-hidden />
            <span className="truncate text-ink-1">{nodeName(r.toNode)}</span>
          </span>
        )
      },
      sortFn: (a, b) => nodeName(a.fromNode).localeCompare(nodeName(b.fromNode)),
    },
    {
      key: 'materialNo', header: 'Material', width: 110, mono: true,
      render: r => r.materialNo,
      sortFn: (a, b) => a.materialNo.localeCompare(b.materialNo),
    },
    {
      key: 'qty', header: 'Qty', width: 80,
      render: r => <span className="block w-full text-right metric-value tabular-nums text-ink-1">{r.qty}</span>,
      sortFn: (a, b) => a.qty - b.qty,
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: r => <StatusChip status={r.status} />,
      sortFn: (a, b) => a.status.localeCompare(b.status),
    },
    {
      key: 'eta', header: 'ETA', width: 80,
      render: r => (
        <span className="block w-full text-right metric-value tabular-nums text-ink-2">
          {etaLabel(r, posByShipment.get(r.shipmentNo) ?? 0, loopT)}
        </span>
      ),
      sortFn: (a, b) => a.departureT + a.transitSeconds - (b.departureT + b.transitSeconds),
    },
    {
      key: 'progress', header: 'Progress', width: 160,
      render: r => <ShipProgress pos={posByShipment.get(r.shipmentNo) ?? 0} status={r.status} />,
      sortFn: (a, b) => (posByShipment.get(a.shipmentNo) ?? 0) - (posByShipment.get(b.shipmentNo) ?? 0),
    },
  ], [laneById, nodeById, posByShipment, loopT])

  const headerRight = (
    <div className="flex items-center gap-3 text-[10px]">
      <span className="flex items-center gap-1.5 text-accent-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden />
        In Transit
        <span className="font-mono tabular-nums text-ink-3">{inTransit}</span>
      </span>
      {lateCount > 0 && (
        <span className="flex items-center gap-1.5 text-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
          Late
          <span className="font-mono tabular-nums text-ink-3">{lateCount}</span>
        </span>
      )}
      {disruptedLanes.size > 0 && (
        <span className="flex items-center gap-1.5 text-critical">
          <span className="h-1.5 w-1.5 rounded-full bg-critical" aria-hidden />
          Disrupted
          <span className="font-mono tabular-nums text-ink-3">{disruptedLanes.size}</span>
        </span>
      )}
    </div>
  )

  const subtitle =
    `${shipments.length.toLocaleString()} in flight · ` +
    `${inTransit} in transit / ${lateCount} late`

  const renderDetail = (row: Shipment) => {
    const lane = laneById.get(row.laneId)
    const pos = posByShipment.get(row.shipmentNo) ?? 0
    const disrupted = disruptedLanes.has(row.laneId)
    const ref =
      row.refDoc.poNo ?? row.refDoc.salesOrderNo ?? '—'
    return (
      <div className="space-y-5 text-xs">
        <section>
          <SectionTitle icon={<Ship size={13} strokeWidth={1.9} />} text="Shipment" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Shipment No" value={row.shipmentNo} mono />
            <DetailField label="Direction" value={row.direction === 'inbound' ? 'Inbound' : 'Outbound'} />
            <DetailField label="Material" value={row.materialNo} mono />
            <DetailField label="Quantity" value={<span className="metric-value tabular-nums">{row.qty}</span>} />
            <DetailField label="Status" value={<StatusChip status={row.status} />} />
            <DetailField label="ETA" value={etaLabel(row, pos, loopT)} mono />
          </div>
        </section>

        <section>
          <SectionTitle icon={<ArrowRight size={13} strokeWidth={1.9} />} text="Lane" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Origin" value={nodeName(row.fromNode)} />
            <DetailField label="Destination" value={nodeName(row.toNode)} />
            <DetailField label="Mode" value={lane ? lane.mode.toUpperCase() : '—'} mono />
            <DetailField label="Transit" value={`${row.transitSeconds}s`} mono />
          </div>
          <div className="mt-3">
            <ShipProgress pos={pos} status={row.status} />
          </div>
          {disrupted && (
            <p className="mt-2 text-[11px] text-critical">Lane under active disruption.</p>
          )}
        </section>

        <section>
          <SectionTitle icon={<PackageCheck size={13} strokeWidth={1.9} />} text="Reference" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label={row.direction === 'inbound' ? 'Purchase Order' : 'Sales Order'} value={ref} mono />
          </div>
        </section>
      </div>
    )
  }

  if (shipments.length === 0) {
    return (
      <div className="flex h-full flex-col p-4">
        <ShipmentsEmpty />
      </div>
    )
  }

  return (
    <ShipmentsTable
      data={shipments}
      columns={columns}
      headerRight={headerRight}
      subtitle={subtitle}
      renderDetail={renderDetail}
      detailSubtitle={r => `${nodeName(r.fromNode)} → ${nodeName(r.toNode)}`}
      rowClassName={r =>
        disruptedLanes.has(r.laneId)
          ? 'row-superhot'
          : r.status === 'in-transit' && (posByShipment.get(r.shipmentNo) ?? 0) >= 1
            ? 'row-hot'
            : undefined
      }
    />
  )
}
