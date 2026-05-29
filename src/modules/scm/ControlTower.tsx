import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  Factory,
  Warehouse,
  Building2,
  Boxes,
  ShieldCheck,
  Plane,
  Ship as ShipIcon,
  Truck,
  TriangleAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Panel } from '../../components/ui/Panel'
import { MetricTile } from '../../components/ui/MetricTile'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useShipments } from '../../lib/useShipments'
import { useUiStore } from '../../lib/uiStore'
import { shipmentPosition } from '../../data/scm/shipmentPosition'
import { cn } from '../../lib/utils'
import type { NetworkNode, NodeKind, Lane, LaneMode, Shipment } from '../../data/scm/types'
import type { ScmModuleProps } from './types'

/* ──────────────────────────────────────────────────────────────────────────
 * Supply Network Control Tower — the SCM hero (plan Visual Design Spec A).
 *
 * A bespoke fixed-viewBox (0 0 1000 560) SVG inside an overflow-hidden Panel so
 * it intrinsically clips (mirrors FabFloor/index + BayLayout). Tiered node glyphs
 * (supplier / FAB-01 / DC / customer) as labeled clusters, curved edge-to-edge
 * lanes with per-mode stroke texture, and shipment dots that are the BayLayout
 * wafer-flow comet — positioned every requestAnimationFrame via REFS from
 * shipmentPosition(loopT, departureT, transitSeconds) (plan ARCH-1), so the
 * lane/node layer never re-renders during transit. Arrival/delivery fire a
 * success sonar beat at the destination; disruptions pulse the affected lane in
 * --sem-critical. Honors prefers-reduced-motion (matchMedia early-return like
 * BayLayout): dots snap to their static computed coord, disruptions stay legible
 * via a static critical stroke.
 *
 * loopT() is reconstructed locally and slaved to the shared clock through the bus
 * — every AppEvent carries `t` (loop seconds), so each event re-syncs the local
 * offset; the driver's departureT values therefore line up with our dots.
 * ────────────────────────────────────────────────────────────────────────── */

const VIEW_W = 1000
const VIEW_H = 560
const LOOP_DURATION = 180

// Node radius per tier (FAB-01 is the largest/brightest anchor).
const NODE_R: Record<NodeKind, number> = {
  supplier: 13,
  fab: 24,
  dc: 16,
  customer: 14,
}

// Tier tone — pinned to the locked accents (plan Fix 3 / E). No new hex.
const NODE_COLOR: Record<NodeKind, string> = {
  supplier: '#818CF8', // accent-3 (upstream)
  fab: '#22D3EE',      // accent   (anchor)
  dc: '#38BDF8',       // accent-2 (mid hub)
  customer: '#34D399', // success  (endpoint)
}

const NODE_GLOW: Record<NodeKind, string> = {
  supplier: 'rgba(129, 140, 248, 0.55)',
  fab: 'rgba(34, 211, 238, 0.6)',
  dc: 'rgba(56, 189, 248, 0.55)',
  customer: 'rgba(52, 211, 153, 0.55)',
}

const NODE_ICON: Record<NodeKind, ReactNode> = {
  supplier: <Building2 size={13} strokeWidth={2} />,
  fab: <Factory size={20} strokeWidth={2} />,
  dc: <Warehouse size={15} strokeWidth={2} />,
  customer: <Boxes size={13} strokeWidth={2} />,
}

const NODE_KIND_LABEL: Record<NodeKind, string> = {
  supplier: 'Supplier',
  fab: 'Fab Plant',
  dc: 'Distribution',
  customer: 'Customer',
}

// Lane mode = stroke TEXTURE, not color (plan B): air dashed thin, sea dotted, truck solid.
const LANE_DASH: Record<LaneMode, string> = {
  air: '7 6',
  sea: '2 6',
  truck: '0',
}

const LANE_ICON: Record<LaneMode, ReactNode> = {
  air: <Plane size={11} strokeWidth={2} />,
  sea: <ShipIcon size={11} strokeWidth={2} />,
  truck: <Truck size={11} strokeWidth={2} />,
}

const SEM_CRITICAL = '#F43F5E'
// Dot core / halo — the FabFloor wafer-flow comet palette.
const DOT_CORE = '#CFFAFE'
// Inbound = cyan→emerald; outbound reuses the LotProgress sky→cyan gradient.
const DOT_TINT: Record<Shipment['direction'], string> = {
  inbound: '#22D3EE',
  outbound: '#38BDF8',
}

/* ── Curved lane geometry ────────────────────────────────────────────────── */

interface LaneGeo {
  lane: Lane
  from: NetworkNode
  to: NetworkNode
  // Edge-to-edge endpoints (offset by node radius so a dot at clamp 0/1 never
  // occludes a node — the FabFloor overflow lesson in map terms, plan Fix 5).
  sx: number
  sy: number
  ex: number
  ey: number
  // Quadratic control point (slight bow so crossings separate).
  cx: number
  cy: number
  path: string
}

function laneGeometry(lane: Lane, from: NetworkNode, to: NetworkNode): LaneGeo {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  // Pull endpoints in to each node's edge.
  const sx = from.x + ux * (NODE_R[from.kind] + 4)
  const sy = from.y + uy * (NODE_R[from.kind] + 4)
  const ex = to.x - ux * (NODE_R[to.kind] + 4)
  const ey = to.y - uy * (NODE_R[to.kind] + 4)
  // Bow the lane perpendicular to its run; deterministic sign by node ordering so
  // parallel legs fan out instead of overlapping.
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2
  const nx = -uy
  const ny = ux
  const bow = dist * 0.16 * (from.y <= to.y ? 1 : -1)
  const cx = mx + nx * bow
  const cy = my + ny * bow
  return {
    lane, from, to, sx, sy, ex, ey, cx, cy,
    path: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
  }
}

/** Point + tangent on a quadratic Bézier at parameter u∈[0,1]. */
function bezierAt(g: LaneGeo, u: number): { x: number; y: number; angle: number } {
  const mu = 1 - u
  const x = mu * mu * g.sx + 2 * mu * u * g.cx + u * u * g.ex
  const y = mu * mu * g.sy + 2 * mu * u * g.cy + u * u * g.ey
  // Derivative for the comet wake angle.
  const dxu = 2 * mu * (g.cx - g.sx) + 2 * u * (g.ex - g.cx)
  const dyu = 2 * mu * (g.cy - g.sy) + 2 * u * (g.ey - g.cy)
  return { x, y, angle: (Math.atan2(dyu, dxu) * 180) / Math.PI }
}

/* ── Local loop-clock slaved to the bus ─────────────────────────────────────
 * The module is handed only scmData + eventBus (no clock instance). Every
 * AppEvent carries `t` (loop seconds from the shared clock), so on each event we
 * record (wallBase, tBase) and read loopT() as the wall-clock delta since the
 * last sync added to tBase, modulo the 180s loop. Events arrive ~1/s, so drift
 * stays sub-second and self-corrects — keeping dots aligned with departureT. */
function createLocalLoopClock() {
  let wallBase = performance.now() / 1000
  let tBase = 0
  let synced = false
  return {
    sync(t: number) {
      wallBase = performance.now() / 1000
      tBase = t
      synced = true
    },
    loopT(): number {
      if (!synced) return 0
      const elapsed = performance.now() / 1000 - wallBase
      return (tBase + elapsed) % LOOP_DURATION
    },
  }
}

/* ── Disruption tracking (lane id → reason), live from the bus ──────────────── */

type DisruptionState = Record<string, string>
type DisruptionAction =
  | { kind: 'raise'; laneId: string; reason: string }
  | { kind: 'clear'; laneId: string }
  | { kind: 'reset' }

function disruptionReducer(state: DisruptionState, action: DisruptionAction): DisruptionState {
  switch (action.kind) {
    case 'raise':
      return { ...state, [action.laneId]: action.reason }
    case 'clear': {
      if (!(action.laneId in state)) return state
      const next = { ...state }
      delete next[action.laneId]
      return next
    }
    case 'reset':
      return {}
  }
}

/* ── Arrival / delivery WOW beats (plan Fix 2) ──────────────────────────────── */

interface Beat {
  id: number
  x: number
  y: number
  kind: 'arrived' | 'delivered'
}
let beatSeq = 0

/* ── Hover tooltip state ────────────────────────────────────────────────────── */

interface DotTip {
  shipmentNo: string
  direction: Shipment['direction']
  ref: string
  materialNo: string
  qty: number
  etaPct: number
  // Screen-space anchor (relative to the SVG wrapper, in px).
  px: number
  py: number
}

/* ── Main module ────────────────────────────────────────────────────────────── */

export function ControlTowerModule({ scmData, eventBus }: ScmModuleProps) {
  const { networkNodes, lanes } = scmData
  const shipments = useShipments(s => s.shipments)
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const nodeById = useMemo(() => {
    const m = new Map<string, NetworkNode>()
    for (const n of networkNodes) m.set(n.id, n)
    return m
  }, [networkNodes])

  // Lane geometry, computed once (static layer — never re-rendered per frame).
  const laneGeos = useMemo(() => {
    const out: LaneGeo[] = []
    for (const lane of lanes) {
      const from = nodeById.get(lane.from)
      const to = nodeById.get(lane.to)
      if (!from || !to) continue
      out.push(laneGeometry(lane, from, to))
    }
    return out
  }, [lanes, nodeById])

  const laneGeoById = useMemo(() => {
    const m = new Map<string, LaneGeo>()
    for (const g of laneGeos) m.set(g.lane.id, g)
    return m
  }, [laneGeos])

  // Live disruptions, hover tooltip, arrival beats. Hydrate the disruption state
  // from the bus ring buffer on mount (fold raised/cleared) so a disruption that
  // was raised BEFORE the user navigated here is shown immediately — matching the
  // sidebar badge instead of an empty panel.
  const [disruptions, dispatchDisruption] = useReducer(
    disruptionReducer,
    eventBus,
    (bus): DisruptionState => {
      const state: DisruptionState = {}
      for (const e of bus.getBuffer()) {
        if (e.topic === 'scm.disruption.raised') state[e.laneId] = e.reason
        else if (e.topic === 'scm.disruption.cleared') delete state[e.laneId]
      }
      return state
    },
  )
  const [tip, setTip] = useState<DotTip | null>(null)
  const [beats, setBeats] = useState<Beat[]>([])

  const localClock = useMemo(() => createLocalLoopClock(), [])

  // Refs to each shipment dot <g>, keyed by shipmentNo — mutated imperatively per
  // rAF (transform=translate), so React never re-renders during transit.
  const dotRefs = useRef(new Map<string, SVGGElement | null>())
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const shipmentsRef = useRef<Shipment[]>(shipments)
  shipmentsRef.current = shipments

  /* — Bus subscriptions: local-clock sync, disruptions, WOW beats — */
  useEffect(() => {
    const fireBeat = (toNode: string, kind: Beat['kind']) => {
      if (reduced) return
      const n = nodeById.get(toNode)
      if (!n) return
      const id = ++beatSeq
      setBeats(prev => [...prev.slice(-5), { id, x: n.x, y: n.y, kind }])
    }

    let lastT = -1
    const subs = [
      // Slave the local loop-clock to the shared clock via every event's `t`.
      // Also detect the loop wrap (t resets 180→0) and clear any disruptions/beats
      // the map is still showing, so nothing stale carries across the boundary.
      eventBus.all$().subscribe(e => {
        localClock.sync(e.t)
        if (lastT >= 0 && e.t < lastT - 30) {
          dispatchDisruption({ kind: 'reset' })
          setBeats([])
        }
        lastT = e.t
      }),
      eventBus.ofTopic('scm.disruption.raised').subscribe(e =>
        dispatchDisruption({ kind: 'raise', laneId: e.laneId, reason: e.reason }),
      ),
      eventBus.ofTopic('scm.disruption.cleared').subscribe(e =>
        dispatchDisruption({ kind: 'clear', laneId: e.laneId }),
      ),
      eventBus.ofTopic('scm.shipment.arrived').subscribe(e => fireBeat(e.toNode, 'arrived')),
      eventBus.ofTopic('scm.shipment.delivered').subscribe(e => fireBeat(e.toNode, 'delivered')),
    ]
    // Disruptions clear two ways: the engine emits a `cleared` for each open lane
    // at the loop boundary (and after a min-dwell during the loop), and the wrap
    // detector above resets the reducer as a belt-and-suspenders.
    return () => {
      for (const s of subs) s.unsubscribe()
    }
  }, [eventBus, localClock, nodeById, reduced])

  /* — The dot animation loop (plan ARCH-1 / Dot model). Imperative refs only. — */
  useEffect(() => {
    let raf = 0

    const place = () => {
      const t = localClock.loopT()
      for (const sh of shipmentsRef.current) {
        const g = dotRefs.current.get(sh.shipmentNo)
        if (!g) continue
        const geo = laneGeoById.get(sh.laneId)
        if (!geo) continue
        const u = shipmentPosition(t, sh.departureT, sh.transitSeconds)
        const p = bezierAt(geo, u)
        g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`)
        // Fade the comet out as it lands (the dot vanishing into the node).
        const fade = sh.status === 'arrived' || sh.status === 'delivered' ? 0 : 1
        g.style.opacity = String(fade)
        const wake = g.querySelector<SVGLineElement>('[data-wake]')
        if (wake) wake.setAttribute('transform', `rotate(${p.angle.toFixed(1)})`)
      }
    }

    if (reduced) {
      // Static snapshot at the computed coord; no rAF glide.
      place()
      return
    }

    const frame = () => {
      place()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [laneGeoById, localClock, reduced, shipments])

  /* — KPI rail counts (recomputed on the store-driven re-render, ~status rate) — */
  const kpis = useMemo(() => {
    const t = localClock.loopT()
    let inTransit = 0
    let late = 0
    let arrived = 0
    let delivered = 0
    for (const s of shipments) {
      if (s.status === 'in-transit' || s.status === 'created') {
        inTransit++
        if (shipmentPosition(t, s.departureT, s.transitSeconds) >= 1) late++
      } else if (s.status === 'arrived') arrived++
      else if (s.status === 'delivered') delivered++
    }
    const completed = arrived + delivered
    const onTime = completed + (inTransit - late)
    const onTimePct = inTransit + completed > 0
      ? Math.round((onTime / (inTransit + completed)) * 100)
      : 100
    return {
      inTransit,
      late,
      onTimePct,
      disruptions: Object.keys(disruptions).length,
      delivered,
    }
    // localClock.loopT() is read for the "late" snapshot; recompute when the store
    // updates (every status transition) — close enough for a KPI tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, disruptions])

  const healthy = kpis.disruptions === 0 && kpis.late === 0

  /* — Per-lane mode lookups for the legend (which modes actually exist) — */
  const activeModes = useMemo(() => {
    const set = new Set<LaneMode>()
    for (const l of lanes) set.add(l.mode)
    return [...set]
  }, [lanes])

  /* — Click handlers (select + cross-filter via the shared store) — */
  const onNodeClick = (n: NetworkNode) =>
    selectEntity({ type: 'networkNode', id: n.id })
  const onLaneClick = (g: LaneGeo) =>
    selectEntity({ type: 'shipment', id: g.lane.id })

  const isSelectedNode = (n: NetworkNode) =>
    selectedEntity?.type === 'networkNode' && selectedEntity.id === n.id
  const isSelectedLane = (g: LaneGeo) =>
    selectedEntity?.type === 'shipment' && selectedEntity.id === g.lane.id

  /* — Drill-in content for the selected node / lane — */
  const drill = useMemo(() => {
    if (!selectedEntity) return null
    if (selectedEntity.type === 'networkNode') {
      const node = nodeById.get(selectedEntity.id)
      if (!node) return null
      const related = shipments.filter(s => s.fromNode === node.id || s.toNode === node.id)
      return { title: node.name, subtitle: `${NODE_KIND_LABEL[node.kind]} · ${node.region}`, related }
    }
    if (selectedEntity.type === 'shipment') {
      const g = laneGeoById.get(selectedEntity.id)
      if (!g) return null
      const related = shipments.filter(s => s.laneId === g.lane.id)
      return {
        title: `${g.from.name} → ${g.to.name}`,
        subtitle: `${g.lane.mode.toUpperCase()} lane · ${g.lane.transitDays}d transit`,
        related,
        disruptionReason: disruptions[g.lane.id] as string | undefined,
      }
    }
    return null
  }, [selectedEntity, nodeById, laneGeoById, shipments, disruptions])

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* KPI rail — a number is the first focal point (plan Fix 10). */}
      <div className="grid shrink-0 grid-cols-5 gap-3">
        <MetricTile
          label="In Transit"
          value={String(kpis.inTransit)}
          unit="ship"
          colorIndex={0}
          icon={<ShipIcon size={14} strokeWidth={2} />}
          data={[kpis.inTransit * 0.7, kpis.inTransit * 0.9, kpis.inTransit]}
        />
        <MetricTile
          label="Late"
          value={String(kpis.late)}
          unit="ship"
          colorIndex={5}
          icon={<TriangleAlert size={14} strokeWidth={2} />}
          delta={kpis.late > 0 ? { text: 'risk', dir: 'up', good: false } : undefined}
        />
        <MetricTile
          label="On-Time"
          value={String(kpis.onTimePct)}
          unit="%"
          colorIndex={3}
          icon={<ShieldCheck size={14} strokeWidth={2} />}
        />
        <MetricTile
          label="Disruptions"
          value={String(kpis.disruptions)}
          unit="open"
          colorIndex={kpis.disruptions > 0 ? 5 : 2}
          icon={<TriangleAlert size={14} strokeWidth={2} />}
          delta={kpis.disruptions > 0 ? { text: 'active', dir: 'up', good: false } : undefined}
        />
        <MetricTile
          label="Delivered"
          value={String(kpis.delivered)}
          unit="ship"
          colorIndex={4}
          icon={<Boxes size={14} strokeWidth={2} />}
        />
      </div>

      {/* The hero map — fixed-viewBox SVG in an overflow-hidden Panel so it
          intrinsically clips (mirrors FabFloor/index + BayLayout). */}
      <Panel className="hud-frame relative flex-1 min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute top-3 right-4 z-10 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-3">
            SUPPLY NETWORK · CONTROL TOWER
          </span>
          {healthy ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-success">
              <ShieldCheck size={12} strokeWidth={2} className="animate-pulse-soft" />
              Nominal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-critical">
              <TriangleAlert size={12} strokeWidth={2} className="animate-pulse-glow" />
              Alert
            </span>
          )}
        </div>

        <div ref={wrapRef} className="relative h-full w-full">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full">
            <defs>
              {/* Soft neon bloom (shared with the FabFloor comet vocabulary). */}
              <filter id="ctTileGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Faint grid backdrop wash (plan Fix 10 depth). */}
              <pattern id="ctFloorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56,189,248,0.05)" strokeWidth="1" />
              </pattern>
              {/* Direction arrowhead (color-blind-safe direction cue, plan Fix 4). */}
              <marker
                id="ctArrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(116,132,158,0.7)" />
              </marker>
            </defs>

            {/* Floor grid wash */}
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#ctFloorGrid)" />

            {/* ── Lane layer (static; never re-renders per frame) ── */}
            <g className="lanes">
              {laneGeos.map(g => {
                const disrupted = g.lane.id in disruptions
                const selected = isSelectedLane(g)
                const stroke = disrupted ? SEM_CRITICAL : NODE_COLOR.supplier
                return (
                  <g key={g.lane.id}>
                    {/* Wide invisible hit area so the curved lane is easy to click. */}
                    <path
                      d={g.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onClick={() => onLaneClick(g)}
                    >
                      <title>
                        {g.from.name} → {g.to.name} · {g.lane.mode} · {g.lane.transitDays}d
                        {disrupted ? ` · DISRUPTED: ${disruptions[g.lane.id]}` : ''}
                      </title>
                    </path>
                    {/* Base lane stroke — per-mode texture (air dashed / sea dotted / truck solid). */}
                    <path
                      d={g.path}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={disrupted ? 0.85 : selected ? 0.7 : 0.34}
                      strokeWidth={disrupted ? 2.4 : selected ? 2.2 : 1.4}
                      strokeDasharray={LANE_DASH[g.lane.mode]}
                      strokeLinecap="round"
                      markerEnd="url(#ctArrow)"
                      className={cn('pointer-events-none', disrupted && !reduced && 'animate-pulse-soft')}
                      style={disrupted ? { filter: 'drop-shadow(0 0 5px rgba(244,63,94,0.7))' } : undefined}
                    />
                    {/* Disruption sonar on the affected lane midpoint (plan: legible statically too). */}
                    {disrupted && (
                      <g transform={`translate(${g.cx} ${g.cy})`} className="pointer-events-none">
                        {!reduced && (
                          <circle r={9} fill="none" stroke={SEM_CRITICAL} strokeWidth={1.4} className="animate-sonar" />
                        )}
                        <circle r={4} fill={SEM_CRITICAL} style={{ filter: 'url(#ctTileGlow)' }} />
                      </g>
                    )}
                  </g>
                )
              })}
            </g>

            {/* ── Shipment dot layer — comet sprites, positioned imperatively (ARCH-1). ── */}
            <g className="pointer-events-auto">
              {shipments.map(sh => {
                const tint = DOT_TINT[sh.direction]
                // Initial placement so a freshly-mounted dot never flashes at the
                // origin before the first rAF tick repositions it.
                const geo0 = laneGeoById.get(sh.laneId)
                const p0 = geo0
                  ? bezierAt(geo0, shipmentPosition(localClock.loopT(), sh.departureT, sh.transitSeconds))
                  : { x: 0, y: 0 }
                return (
                  <g
                    key={sh.shipmentNo}
                    ref={el => {
                      if (el) dotRefs.current.set(sh.shipmentNo, el)
                      else dotRefs.current.delete(sh.shipmentNo)
                    }}
                    transform={`translate(${p0.x.toFixed(2)} ${p0.y.toFixed(2)})`}
                    className={cn('cursor-pointer', !reduced && 'animate-rise')}
                    onMouseEnter={() => {
                      const wrap = wrapRef.current
                      const g = dotRefs.current.get(sh.shipmentNo)
                      if (!wrap || !g) return
                      const wr = wrap.getBoundingClientRect()
                      const gr = g.getBoundingClientRect()
                      const t = localClock.loopT()
                      setTip({
                        shipmentNo: sh.shipmentNo,
                        direction: sh.direction,
                        ref: sh.refDoc.poNo ?? sh.refDoc.salesOrderNo ?? '—',
                        materialNo: sh.materialNo,
                        qty: sh.qty,
                        etaPct: Math.round(shipmentPosition(t, sh.departureT, sh.transitSeconds) * 100),
                        px: gr.left - wr.left + gr.width / 2,
                        py: gr.top - wr.top,
                      })
                    }}
                    onMouseLeave={() => setTip(null)}
                    onClick={() => selectEntity({ type: 'shipment', id: sh.laneId })}
                  >
                    {/* Faint dashed wake (rotated to the lane tangent each frame). */}
                    <line
                      data-wake
                      x1={0}
                      y1={0}
                      x2={-13}
                      y2={0}
                      stroke={tint}
                      strokeWidth={1}
                      strokeDasharray="3 4"
                      strokeOpacity={0.5}
                    />
                    {/* Blurred outer halo */}
                    <circle r={7} fill={tint} style={{ filter: 'blur(3px)' }} opacity={0.45} />
                    {/* White-hot core through the bloom filter (the BayLayout comet). */}
                    <circle
                      r={3.4}
                      fill={DOT_CORE}
                      stroke="#16223A"
                      strokeWidth={0.75}
                      style={{ filter: `url(#ctTileGlow) drop-shadow(0 0 6px ${tint})` }}
                    />
                    <title>
                      {sh.shipmentNo} · {sh.direction} · {sh.materialNo} ×{sh.qty}
                    </title>
                  </g>
                )
              })}
            </g>

            {/* ── Arrival / delivery WOW beats (success sonar + node flash). ── */}
            <g className="pointer-events-none">
              {beats.map(b => (
                <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
                  <circle
                    r={NODE_R.fab}
                    fill="none"
                    stroke="#34D399"
                    strokeWidth={2}
                    className="animate-sonar"
                    onAnimationIteration={() => setBeats(prev => prev.filter(q => q.id !== b.id))}
                  />
                  <circle r={NODE_R.fab * 0.55} fill="rgba(52,211,153,0.18)" className="animate-pulse-glow" />
                </g>
              ))}
            </g>

            {/* ── Node clusters (static): bloom halo + glyph + lucide icon. ── */}
            <g className="nodes">
              {networkNodes.map(n => {
                const r = NODE_R[n.kind]
                const color = NODE_COLOR[n.kind]
                const glow = NODE_GLOW[n.kind]
                const isFab = n.kind === 'fab'
                const selected = isSelectedNode(n)
                return (
                  <g
                    key={n.id}
                    className="cursor-pointer"
                    onClick={() => onNodeClick(n)}
                  >
                    {/* Bloom halo */}
                    <circle cx={n.x} cy={n.y} r={r + 6} fill={glow} style={{ filter: 'blur(6px)' }} opacity={0.7} />
                    {/* Ambient breathing ring (plan Fix 11) */}
                    {!reduced && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r + 3}
                        fill="none"
                        stroke={color}
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        className="animate-pulse-soft"
                      />
                    )}
                    {/* Selection ring */}
                    {selected && (
                      <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
                    )}
                    {/* FAB-01 anchor: literal glow-cyan (brighter drop-shadow) + hud-frame
                        corner brackets, drawn in SVG so it scales with the viewBox. */}
                    {isFab && (
                      <g className="pointer-events-none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
                        {[
                          [-1, -1], [1, -1], [-1, 1], [1, 1],
                        ].map(([sxn, syn], i) => {
                          const b = r + 8
                          const len = 7
                          const bx = n.x + sxn * b
                          const by = n.y + syn * b
                          return (
                            <g key={i}>
                              <line x1={bx} y1={by} x2={bx - sxn * len} y2={by} />
                              <line x1={bx} y1={by} x2={bx} y2={by - syn * len} />
                            </g>
                          )
                        })}
                      </g>
                    )}
                    {/* Node body */}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill="rgba(14,20,34,0.92)"
                      stroke={color}
                      strokeWidth={isFab ? 2.4 : 1.6}
                      style={{
                        filter: isFab
                          ? 'url(#ctTileGlow) drop-shadow(0 0 10px rgba(34,211,238,0.7))'
                          : 'url(#ctTileGlow)',
                      }}
                    />
                    {/* FAB-01 anchor: inner accent core. */}
                    {isFab && <circle cx={n.x} cy={n.y} r={r - 7} fill={color} opacity={0.18} />}
                    {/* lucide icon centered in the node. */}
                    <foreignObject x={n.x - r} y={n.y - r} width={r * 2} height={r * 2}>
                      <div
                        className="flex h-full w-full items-center justify-center pointer-events-none"
                        style={{ color }}
                      >
                        {NODE_ICON[n.kind]}
                      </div>
                    </foreignObject>
                  </g>
                )
              })}
            </g>

            {/* ── Node labels (labelSide-anchored, dedicated band, no collisions). ── */}
            <g className="pointer-events-none labels">
              {networkNodes.map(n => {
                const r = NODE_R[n.kind]
                let tx = n.x
                let ty = n.y
                let anchor: 'start' | 'middle' | 'end' = 'middle'
                switch (n.labelSide) {
                  case 'left': tx = n.x - r - 8; ty = n.y + 3; anchor = 'end'; break
                  case 'right': tx = n.x + r + 8; ty = n.y + 3; anchor = 'start'; break
                  case 'top': tx = n.x; ty = n.y - r - 9; anchor = 'middle'; break
                  case 'bottom': tx = n.x; ty = n.y + r + 17; anchor = 'middle'; break
                }
                return (
                  <g key={`lbl-${n.id}`}>
                    <text
                      x={tx}
                      y={ty}
                      textAnchor={anchor}
                      className="font-mono"
                      style={{ fontSize: 11, fontWeight: 600, fill: '#E8EEF7' }}
                    >
                      {n.name}
                    </text>
                    <text
                      x={tx}
                      y={ty + 12}
                      textAnchor={anchor}
                      className="font-mono"
                      style={{ fontSize: 9, letterSpacing: '0.1em', fill: '#74849E' }}
                    >
                      {NODE_KIND_LABEL[n.kind].toUpperCase()} · {n.region}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Decorative scan sweep depth (CSS, reduced-motion aware). */}
          <div className="scan-sweep pointer-events-none absolute inset-0 rounded-lg" aria-hidden />

          {/* Active Disruptions — a persistent, clickable list so disruptions are
              never just a fleeting red flash; each row selects (and highlights) its
              lane and opens the drill-in with the reason. */}
          {Object.keys(disruptions).length > 0 && (
            <div className="glass hud-frame absolute top-2 left-2 z-10 flex max-w-[248px] flex-col gap-1 rounded-md px-3 py-2">
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-critical">
                <TriangleAlert size={11} strokeWidth={2.2} className={cn(!reduced && 'animate-pulse-soft')} />
                Active Disruptions · {Object.keys(disruptions).length}
              </span>
              {Object.entries(disruptions).slice(0, 4).map(([laneId, reason]) => {
                const g = laneGeoById.get(laneId)
                const selected = selectedEntity?.type === 'shipment' && selectedEntity.id === laneId
                return (
                  <button
                    key={laneId}
                    onClick={() => selectEntity({ type: 'shipment', id: laneId })}
                    className={cn(
                      'flex flex-col items-start rounded px-1.5 py-0.5 text-left transition-colors hover:bg-surface-3/70',
                      selected && 'bg-critical/10',
                    )}
                  >
                    <span className="font-mono text-[10px] leading-tight text-ink-1">
                      {g ? `${g.from.name} → ${g.to.name}` : laneId}
                    </span>
                    <span className="text-[9px] capitalize leading-tight text-critical/90">{reason}</span>
                  </button>
                )
              })}
              {Object.keys(disruptions).length > 4 && (
                <span className="px-1.5 text-[9px] text-ink-3">
                  +{Object.keys(disruptions).length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Warm no-disruption state — emerald ShieldCheck, on-brand (plan Fix F). */}
          {healthy && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="glass inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 text-[10px] text-success">
                <ShieldCheck size={12} strokeWidth={2} />
                Network healthy — all lanes nominal
              </span>
            </div>
          )}

          {/* HUD legend (plan: glass + hud-frame bottom-left). */}
          <div
            className="glass hud-frame rounded-md absolute bottom-2 left-2 flex flex-col gap-1.5 px-3 py-2"
            aria-label="Network legend"
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-accent-3/70">
              Network
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(['supplier', 'fab', 'dc', 'customer'] as NodeKind[]).map(k => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: NODE_COLOR[k], boxShadow: `0 0 6px ${NODE_GLOW[k]}` }}
                    aria-hidden
                  />
                  <span className="text-[10px] leading-none text-ink-2">{NODE_KIND_LABEL[k]}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {activeModes.map(m => (
                <span key={m} className="inline-flex items-center gap-1 text-ink-3">
                  <span style={{ color: '#74849E' }}>{LANE_ICON[m]}</span>
                  <span className="text-[10px] leading-none capitalize text-ink-2">{m}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn('h-2 w-2 rounded-full', !reduced && 'animate-pulse-soft')}
                  style={{ background: SEM_CRITICAL, boxShadow: `0 0 6px ${SEM_CRITICAL}` }}
                  aria-hidden
                />
                <span className="text-[10px] leading-none text-ink-2">Disruption</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 border-t border-edge pt-1 text-[10px] tabular-nums text-ink-3">
              <span>
                <span className="font-mono text-accent">{kpis.inTransit}</span> in transit
              </span>
              <span>
                <span className="font-mono text-critical">{kpis.disruptions}</span> disrupted
              </span>
            </div>
          </div>

          {/* Hover ETA / PO tooltip (ChartTooltip-style glass card). */}
          {tip && (
            <div
              className="glass pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-edge-strong px-2.5 py-1.5"
              style={{ left: tip.px, top: tip.py - 8 }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: DOT_TINT[tip.direction], boxShadow: `0 0 6px ${DOT_TINT[tip.direction]}` }}
                  aria-hidden
                />
                <span className="font-mono text-[11px] text-ink-1">{tip.shipmentNo}</span>
                <span className="text-[9px] uppercase tracking-[0.12em] text-ink-3">{tip.direction}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-3">
                {tip.ref} · {tip.materialNo} ×{tip.qty}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
                    style={{ width: `${tip.etaPct}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] tabular-nums text-ink-3">{tip.etaPct}%</span>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Drill-in: click a node/lane → its shipment list (cross-filters the
          Shipments table via the shared selectedEntity store). */}
      {drill && (
        <DrillInPanel title={drill.title} subtitle={drill.subtitle}>
          <div className="flex flex-col gap-2">
            {/* Disruption banner — when the selected lane is under an active
                disruption, lead with the reason so a click on the red line
                actually explains what happened. */}
            {drill.disruptionReason && (
              <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-2.5 py-2">
                <TriangleAlert size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-critical" />
                <div>
                  <div className="text-[11px] font-semibold text-critical">Lane disrupted</div>
                  <div className="text-[10px] capitalize text-ink-2">{drill.disruptionReason}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-ink-3">
                    Shipments on this leg are delayed
                  </div>
                </div>
              </div>
            )}
            {drill.related.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3/60 text-success">
                  <ShieldCheck size={15} strokeWidth={1.9} />
                </span>
                <p className="text-[11px] text-ink-3">No shipments on this leg right now.</p>
              </div>
            ) : (
              drill.related.map(s => {
                const t = localClock.loopT()
                const pct = Math.round(shipmentPosition(t, s.departureT, s.transitSeconds) * 100)
                const tone = STATUS_TONE[s.status]
                return (
                  <div
                    key={s.shipmentNo}
                    className="rounded-md border border-edge bg-surface-2/50 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.bg)}
                        style={{ boxShadow: `0 0 6px ${tone.glow}` }}
                        aria-hidden
                      />
                      <span className="font-mono text-[11px] text-ink-1">{s.shipmentNo}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-ink-3">
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-ink-3">
                      {s.refDoc.poNo ?? s.refDoc.salesOrderNo ?? '—'} · {s.materialNo} ×{s.qty}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
                          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(45,212,191,0.55)' }}
                        />
                      </div>
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-ink-3">{pct}%</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}

/* Status tone for the drill-in chips (mirrors the Cockpit DocChip tone map). */
const STATUS_TONE: Record<Shipment['status'], { bg: string; glow: string }> = {
  created: { bg: 'bg-ink-3', glow: 'rgba(116,132,158,0.6)' },
  'in-transit': { bg: 'bg-accent-2', glow: 'rgba(56,189,248,0.6)' },
  arrived: { bg: 'bg-success', glow: 'rgba(52,211,153,0.6)' },
  delivered: { bg: 'bg-success', glow: 'rgba(52,211,153,0.6)' },
}
