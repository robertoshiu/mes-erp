import { useMemo, useEffect, useState, lazy, Suspense, type ComponentType } from 'react'
import {
  LayoutGrid, Boxes, Cpu, Activity, ClipboardList, AlertTriangle, Gauge as GaugeIcon, Hexagon,
  Network, CalendarRange, ShoppingCart, Factory, Warehouse, Truck, Package, Building2, ListTree, Landmark,
  Radar, Ship, TrendingUp, BadgeCheck,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useUiStore, type ModuleRoute, type BadgeCounts } from './lib/uiStore'
import { GlobalSvgDefs } from './lib/chartTheme'
import type { E10State } from './lib/events'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { generateMasterData } from './data/master'
import { generateErpData } from './data/erp'
import { countShortages } from './data/erp/coverage'
import { generateScmData } from './data/scm'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'
import { createTimelineEngine } from './data/timeline-engine'
import { createErpTimelineEngine } from './data/erp/erp-timeline-engine'
import { createBridge } from './data/erp/bridge'
import { createScmTimelineEngine } from './data/scm/scm-timeline-engine'
import { createShipmentDriver } from './data/scm/shipment-driver'
import { useShipments } from './lib/useShipments'
import { shipmentPosition } from './data/scm/shipmentPosition'
import {
  NETWORK_VIEW_W,
  NETWORK_VIEW_H,
  SUPPLIER_SLOTS,
  DC_SLOTS,
  CUSTOMER_SLOTS,
  FAB_SLOT,
} from './data/scm/networkNodes'

// Route-level code-split: each module is its own chunk (recharts/framer load lazily).
const FabFloor = lazy(() => import('./modules/FabFloor').then(m => ({ default: m.FabFloor })))
const ProductionModule = lazy(() => import('./modules/Production').then(m => ({ default: m.ProductionModule })))
const EquipmentModule = lazy(() => import('./modules/Equipment').then(m => ({ default: m.EquipmentModule })))
const SpcModule = lazy(() => import('./modules/SPC').then(m => ({ default: m.SpcModule })))
const RecipeModule = lazy(() => import('./modules/Recipe').then(m => ({ default: m.RecipeModule })))
const AlarmsModule = lazy(() => import('./modules/Alarms').then(m => ({ default: m.AlarmsModule })))
const KpiDashboard = lazy(() => import('./modules/KPI').then(m => ({ default: m.KpiDashboard })))
const CockpitModule = lazy(() => import('./modules/erp/Cockpit').then(m => ({ default: m.CockpitModule })))
const MrpModule = lazy(() => import('./modules/erp/Mrp').then(m => ({ default: m.MrpModule })))
const SalesOrdersModule = lazy(() => import('./modules/erp/SalesOrders').then(m => ({ default: m.SalesOrdersModule })))
const ProductionOrdersModule = lazy(() => import('./modules/erp/ProductionOrders').then(m => ({ default: m.ProductionOrdersModule })))
const InventoryModule = lazy(() => import('./modules/erp/Inventory').then(m => ({ default: m.InventoryModule })))
const ProcurementModule = lazy(() => import('./modules/erp/Procurement').then(m => ({ default: m.ProcurementModule })))
const MaterialsModule = lazy(() => import('./modules/erp/Materials').then(m => ({ default: m.MaterialsModule })))
const BusinessPartnersModule = lazy(() => import('./modules/erp/BusinessPartners').then(m => ({ default: m.BusinessPartnersModule })))
const BomModule = lazy(() => import('./modules/erp/Bom').then(m => ({ default: m.BomModule })))
const FinanceModule = lazy(() => import('./modules/erp/Finance').then(m => ({ default: m.FinanceModule })))
const ControlTowerModule = lazy(() => import('./modules/scm/ControlTower').then(m => ({ default: m.ControlTowerModule })))
const ShipmentsModule = lazy(() => import('./modules/scm/Shipments').then(m => ({ default: m.ShipmentsModule })))
const DemandPlanningModule = lazy(() => import('./modules/scm/DemandPlanning').then(m => ({ default: m.DemandPlanningModule })))
const SupplierScorecardsModule = lazy(() => import('./modules/scm/SupplierScorecards').then(m => ({ default: m.SupplierScorecardsModule })))

type IconCmp = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

interface NavItem {
  route: ModuleRoute
  label: string
  Icon: IconCmp
  badgeKey?: keyof BadgeCounts
}

interface NavGroup { group: string; items: NavItem[] }
// `labelClass` tints the domain group-label tick (Spec E): MES/ERP cyan, SCM indigo.
interface NavDomain { domain: string; labelClass: string; groups: NavGroup[] }

const DOMAINS: NavDomain[] = [
  {
    domain: 'MES',
    labelClass: 'text-accent/70',
    groups: [
      { group: 'Operations', items: [
        { route: 'fab-floor', label: 'Fab Floor', Icon: LayoutGrid },
        { route: 'production', label: 'Production', Icon: Boxes, badgeKey: 'production' },
        { route: 'equipment', label: 'Equipment', Icon: Cpu, badgeKey: 'equipmentDown' },
      ] },
      { group: 'Quality', items: [
        { route: 'spc', label: 'SPC / Quality', Icon: Activity },
        { route: 'recipe', label: 'Recipe Mgmt', Icon: ClipboardList },
      ] },
      { group: 'Command', items: [
        { route: 'alarms', label: 'Alarms', Icon: AlertTriangle, badgeKey: 'alarms' },
        { route: 'kpi', label: 'KPI Dashboard', Icon: GaugeIcon },
      ] },
    ],
  },
  {
    domain: 'ERP',
    labelClass: 'text-accent/70',
    groups: [
      { group: 'Planning', items: [
        { route: 'erp-cockpit', label: 'Document Flow', Icon: Network },
        { route: 'mrp', label: 'MRP / Planning', Icon: CalendarRange, badgeKey: 'shortages' },
        { route: 'sales-orders', label: 'Sales Orders', Icon: ShoppingCart, badgeKey: 'openOrders' },
        { route: 'production-orders', label: 'Production Orders', Icon: Factory },
      ] },
      { group: 'Logistics', items: [
        { route: 'inventory', label: 'Inventory', Icon: Warehouse },
        { route: 'procurement', label: 'Procurement', Icon: Truck, badgeKey: 'latePOs' },
      ] },
      { group: 'Master Data', items: [
        { route: 'materials', label: 'Materials', Icon: Package },
        { route: 'business-partners', label: 'Business Partners', Icon: Building2 },
        { route: 'bom', label: 'Bill of Materials', Icon: ListTree },
      ] },
      { group: 'Finance', items: [
        { route: 'finance', label: 'Finance', Icon: Landmark },
      ] },
    ],
  },
  {
    domain: 'SCM',
    labelClass: 'text-accent-3/70',
    groups: [
      { group: 'Control Tower', items: [
        { route: 'control-tower', label: 'Control Tower', Icon: Radar, badgeKey: 'disruptions' },
        { route: 'shipments', label: 'Shipments', Icon: Ship, badgeKey: 'inTransit' },
      ] },
      { group: 'Planning', items: [
        { route: 'demand-planning', label: 'Demand Planning', Icon: TrendingUp },
        { route: 'supplier-scorecards', label: 'Supplier Scorecards', Icon: BadgeCheck },
      ] },
    ],
  },
]

// Flat route→label lookup for friendly module names (e.g. ErrorBoundary fallback copy).
const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  DOMAINS.flatMap(d => d.groups.flatMap(g => g.items.map(i => [i.route, i.label]))),
)

// Badge color by semantic: alarms/shortages = critical pulse, late/down = warn, counts = accent.
function badgeClass(key: keyof BadgeCounts): { cls: string; pulse: boolean } {
  if (key === 'alarms' || key === 'shortages' || key === 'disruptions') return { cls: 'bg-critical text-white', pulse: true }
  if (key === 'equipmentDown' || key === 'latePOs' || key === 'lateShipments') return { cls: 'bg-warn/20 text-warn', pulse: false }
  return { cls: 'bg-accent/15 text-accent', pulse: false }
}

function ModuleSkeleton() {
  return (
    <div className="h-full p-4">
      <div className="relative panel h-full w-full animate-pulse-soft">
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
          Loading module…
        </span>
      </div>
    </div>
  )
}

// Per-tier ghost radii mirror ControlTower's NODE_R so the FAB reads as the
// larger center anchor; the skeleton is a static placeholder (no live data).
const GHOST_NODE_R = { supplier: 13, fab: 24, dc: 16, customer: 14 }

// Quadratic ghost-lane path, same shape family as ControlTower's laneGeometry
// (perpendicular bow = dist*0.16) so the scaffolding tracks the live map.
function ghostLanePath(sx: number, sy: number, ex: number, ey: number): string {
  const dx = ex - sx
  const dy = ey - sy
  const dist = Math.hypot(dx, dy) || 1
  const bow = dist * 0.16 * (sy <= ey ? 1 : -1)
  const nx = -dy / dist
  const ny = dx / dist
  const cx = (sx + ex) / 2 + nx * bow
  const cy = (sy + ey) / 2 + ny * bow
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
}

// Map-shaped Suspense fallback for the flagship Control Tower hero. Reuses the
// live hero chrome + baked slot coords so the chunk swap causes no layout jump.
function ControlTowerSkeleton() {
  const lanes: string[] = []
  for (const s of SUPPLIER_SLOTS) lanes.push(ghostLanePath(s.x, s.y, FAB_SLOT.x, FAB_SLOT.y))
  for (const d of DC_SLOTS) lanes.push(ghostLanePath(FAB_SLOT.x, FAB_SLOT.y, d.x, d.y))
  for (const d of DC_SLOTS) {
    for (const c of CUSTOMER_SLOTS) lanes.push(ghostLanePath(d.x, d.y, c.x, c.y))
  }
  return (
    <section className="h-full flex flex-col gap-2.5 p-3 min-h-0">
      <div className="panel hud-frame relative flex-1 min-h-0 overflow-hidden">
        <div className="relative h-full w-full">
          <svg viewBox={`0 0 ${NETWORK_VIEW_W} ${NETWORK_VIEW_H}`} className="w-full h-full">
            <g className="animate-pulse-soft">
              {lanes.map((d, i) => (
                <path
                  key={`ghost-lane-${i}`}
                  d={d}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={1.2}
                  strokeOpacity={0.7}
                />
              ))}
              {SUPPLIER_SLOTS.map((s, i) => (
                <circle
                  key={`ghost-supplier-${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={GHOST_NODE_R.supplier}
                  fill="var(--ink-mute)"
                  fillOpacity={0.18}
                  stroke="var(--edge)"
                  strokeWidth={1}
                />
              ))}
              {DC_SLOTS.map((d, i) => (
                <circle
                  key={`ghost-dc-${i}`}
                  cx={d.x}
                  cy={d.y}
                  r={GHOST_NODE_R.dc}
                  fill="var(--ink-mute)"
                  fillOpacity={0.18}
                  stroke="var(--edge)"
                  strokeWidth={1}
                />
              ))}
              {CUSTOMER_SLOTS.map((c, i) => (
                <circle
                  key={`ghost-customer-${i}`}
                  cx={c.x}
                  cy={c.y}
                  r={GHOST_NODE_R.customer}
                  fill="var(--ink-mute)"
                  fillOpacity={0.18}
                  stroke="var(--edge)"
                  strokeWidth={1}
                />
              ))}
              <circle
                cx={FAB_SLOT.x}
                cy={FAB_SLOT.y}
                r={GHOST_NODE_R.fab}
                fill="var(--ink-mute)"
                fillOpacity={0.22}
                stroke="var(--edge)"
                strokeWidth={1.4}
              />
            </g>
          </svg>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const masterData = useMemo(() => generateMasterData(), [])
  const erpData = useMemo(() => generateErpData(masterData), [masterData])
  const scmData = useMemo(() => generateScmData(masterData, erpData), [masterData, erpData])
  const clock = useMemo(() => createClock(), [])
  const eventBus = useMemo(() => createEventBus(), [])
  const engine = useMemo(() => createTimelineEngine(clock, eventBus, masterData), [clock, eventBus, masterData])
  const erpEngine = useMemo(() => createErpTimelineEngine(clock, eventBus, erpData), [clock, eventBus, erpData])
  const bridge = useMemo(() => createBridge(clock, eventBus, masterData, erpData), [clock, eventBus, masterData, erpData])
  const scmEngine = useMemo(() => createScmTimelineEngine(clock, eventBus, scmData), [clock, eventBus, scmData])
  const scmDriver = useMemo(() => createShipmentDriver(clock, eventBus, masterData, erpData, scmData), [clock, eventBus, masterData, erpData, scmData])

  const activeRoute = useUiStore(s => s.activeRoute)
  const activeLabel = ROUTE_LABELS[activeRoute] ?? activeRoute
  const setRoute = useUiStore(s => s.setRoute)
  const badges = useUiStore(s => s.badges)

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const toggleGroup = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })

  // Viewport width gate
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Start clock + MES/ERP/SCM engines + bridge + shipment-driver on mount.
  useEffect(() => {
    engine.preRoll()
    erpEngine.preRoll()
    scmEngine.preRoll()
    clock.start()
    // Subscribe-before-emit (CRITICAL): the bridge AND the shipment-driver must
    // subscribe before erpEngine.start() emits erp.po.created / lot.complete,
    // or the first inbound/outbound legs are dropped (plan ARCH-2 ordering).
    bridge.start()
    scmDriver.start()
    engine.start()
    erpEngine.start()
    scmEngine.start()
    return () => {
      scmEngine.stop()
      scmDriver.stop()
      erpEngine.stop()
      engine.stop()
      bridge.stop()
      clock.destroy()
    }
  }, [clock, engine, erpEngine, bridge, scmEngine, scmDriver])

  // Subscribe to shift boundary events
  useEffect(() => {
    const sub = eventBus.ofTopic('shift.boundary').subscribe(e => {
      useUiStore.getState().setShift(e.shiftCode)
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  // Static ERP badge counts (derived from the seeded ERP dataset).
  useEffect(() => {
    const shortages = countShortages(erpData.inventory, erpData.materials)
    const openOrders = erpData.salesOrders.filter(o => o.status === 'open' || o.status === 'in-process').length
    const latePOs = erpData.purchaseOrders.filter(p => p.status === 'late').length
    useUiStore.getState().updateBadges({ shortages, openOrders, latePOs })
  }, [erpData])

  // MES badge counts (throttled at 1s). Derived from the event ring buffer each
  // tick rather than accumulated, so a 180s loop replay can't make them drift:
  // alarms = distinct unacked alarmIds; equipmentDown = tools whose latest
  // equip.state left them down.
  useEffect(() => {
    const throttle = setInterval(() => {
      const buffer = eventBus.getBuffer()

      // Per-id alarm fold (oldest→newest): the scripted spine re-emits the SAME
      // alarmId every 180s loop, so the ring holds multiple copies of one alarm.
      // Counting events would climb across loops; instead fold to a latest-state
      // map (alarmId → unacked?) so each id contributes at most once. A later
      // alarm.raised reactivates an id; an alarm.ack clears only that current
      // instance (a subsequent same-id raise re-activates it).
      const alarmUnacked = new Map<string, boolean>()
      for (const e of buffer) {
        if (e.topic === 'alarm.raised') {
          // pre-acked spine alarms carry ackOperatorId → already acknowledged.
          alarmUnacked.set(e.alarmId, !e.ackOperatorId)
        } else if (e.topic === 'alarm.ack') {
          alarmUnacked.set(e.alarmId, false)
        }
      }
      let alarms = 0
      for (const unacked of alarmUnacked.values()) {
        if (unacked) alarms++
      }

      const latestState = new Map<string, E10State>()
      for (const e of buffer) {
        if (e.topic === 'equip.state') latestState.set(e.toolId, e.toState)
      }
      let equipmentDown = 0
      for (const state of latestState.values()) {
        if (state === 'SDT' || state === 'UDT') equipmentDown++
      }

      const production = masterData.lots.filter(l => l.status === 'in-process').length

      useUiStore.getState().updateBadges({ alarms, production, equipmentDown })
    }, 1000)
    return () => clearInterval(throttle)
  }, [eventBus, masterData])

  // SCM badge counts (throttled at 1s, mirroring the MES badge effect): inTransit
  // + lateShipments read live from useShipments; disruptions recomputed from the
  // ring buffer each tick rather than a closure counter. Fold raised/cleared by
  // laneId (latest-wins, same fold ControlTower seeds its panel from): an open
  // disruption sets its laneId, a cleared removes it. This always equals the
  // Control Tower's active-disruptions list, self-heals after the loop wrap, and
  // also counts disruptions raised before this effect mounted.
  useEffect(() => {
    const throttle = setInterval(() => {
      const t = clock.loopT()
      const shipments = useShipments.getState().shipments
      let inTransit = 0
      let lateShipments = 0
      for (const s of shipments) {
        if (s.status !== 'in-transit') continue
        inTransit++
        // "Late" = past its ETA but the arrival transition hasn't fired yet.
        if (shipmentPosition(t, s.departureT, s.transitSeconds) >= 1) lateShipments++
      }

      const openLanes = new Set<string>()
      for (const e of eventBus.getBuffer()) {
        if (e.topic === 'scm.disruption.raised') openLanes.add(e.laneId)
        else if (e.topic === 'scm.disruption.cleared') openLanes.delete(e.laneId)
      }

      useUiStore.getState().updateBadges({ inTransit, lateShipments, disruptions: openLanes.size })
    }, 1000)
    return () => clearInterval(throttle)
  }, [eventBus, clock])

  // Count on-shift operators (reactive to shift changes)
  const currentShift = useUiStore(s => s.currentShift)
  const operatorCount = useMemo(() => {
    return masterData.operators.filter(op => op.shift === currentShift).length
  }, [masterData, currentShift])

  const renderModule = () => {
    switch (activeRoute) {
      case 'fab-floor': return <FabFloor eventBus={eventBus} masterData={masterData} />
      case 'production': return <ProductionModule eventBus={eventBus} masterData={masterData} />
      case 'equipment': return <EquipmentModule eventBus={eventBus} masterData={masterData} />
      case 'spc': return <SpcModule eventBus={eventBus} />
      case 'recipe': return <RecipeModule masterData={masterData} />
      case 'alarms': return <AlarmsModule eventBus={eventBus} />
      case 'kpi': return <KpiDashboard eventBus={eventBus} totalEquipment={masterData.equipment.length} />
      case 'erp-cockpit': return <CockpitModule erpData={erpData} eventBus={eventBus} />
      case 'mrp': return <MrpModule erpData={erpData} eventBus={eventBus} />
      case 'sales-orders': return <SalesOrdersModule erpData={erpData} eventBus={eventBus} />
      case 'production-orders': return <ProductionOrdersModule erpData={erpData} eventBus={eventBus} />
      case 'inventory': return <InventoryModule erpData={erpData} eventBus={eventBus} />
      case 'procurement': return <ProcurementModule erpData={erpData} eventBus={eventBus} />
      case 'materials': return <MaterialsModule erpData={erpData} eventBus={eventBus} />
      case 'business-partners': return <BusinessPartnersModule erpData={erpData} eventBus={eventBus} />
      case 'bom': return <BomModule erpData={erpData} eventBus={eventBus} />
      case 'finance': return <FinanceModule erpData={erpData} eventBus={eventBus} />
      case 'control-tower': return <ControlTowerModule scmData={scmData} eventBus={eventBus} />
      case 'shipments': return <ShipmentsModule scmData={scmData} eventBus={eventBus} />
      case 'demand-planning': return <DemandPlanningModule scmData={scmData} eventBus={eventBus} />
      case 'supplier-scorecards': return <SupplierScorecardsModule scmData={scmData} eventBus={eventBus} />
      default: return null
    }
  }

  if (windowWidth < 1280) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas p-8 text-center">
        <div className="panel max-w-sm p-8">
          <Hexagon className="mx-auto mb-4 text-accent" size={40} strokeWidth={1.5} />
          <div className="text-base font-semibold text-ink-1 mb-1">FabPulse Command Center</div>
          <div className="text-sm text-ink-3">
            Requires a viewport &ge; 1280px. Open on a desktop or rotate your tablet.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen text-ink-1 font-sans overflow-hidden">
      <GlobalSvgDefs />
      {/* Sidebar */}
      <nav
        className="w-56 shrink-0 flex flex-col bg-surface border-r border-edge relative"
        aria-label="Module navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-edge">
          <span className="relative flex items-center justify-center">
            <Hexagon className="text-accent" size={28} strokeWidth={1.75} fill="rgba(34,211,238,0.12)" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft"
              style={{ boxShadow: '0 0 8px var(--accent-glow)' }} />
          </span>
          <div className="leading-tight">
            <div className="text-base font-semibold text-ink-1 tracking-tight text-glow-soft">FabPulse</div>
            <div className="text-[9px] uppercase tracking-[0.28em] text-ink-3">MES · ERP · SCM</div>
          </div>
        </div>

        {/* Nav: MES + ERP + SCM domains, collapsible groups */}
        <div className="flex-1 overflow-y-auto py-2">
          {DOMAINS.map(({ domain, labelClass, groups }) => (
            <div key={domain} className="mb-1.5">
              <div className={`px-4 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.26em] ${labelClass}`}>
                {domain}
              </div>
              {groups.map(({ group, items }) => {
                const gkey = `${domain}:${group}`
                const isCollapsed = collapsed.has(gkey)
                return (
                  <div key={gkey} className="mb-0.5">
                    <button
                      onClick={() => toggleGroup(gkey)}
                      aria-expanded={!isCollapsed}
                      className="group/g w-full flex items-center gap-1 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-mute hover:text-ink-3 hover:bg-surface-3/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {isCollapsed
                        ? <ChevronRight size={11} className="shrink-0" />
                        : <ChevronDown size={11} className="shrink-0" />}
                      <span>{group}</span>
                    </button>
                    {!isCollapsed && items.map(({ route, label, Icon, badgeKey }) => {
                      const isActive = activeRoute === route
                      const badge = badgeKey ? badges[badgeKey] : 0
                      const bstyle = badgeKey ? badgeClass(badgeKey) : null
                      return (
                        <button
                          key={route}
                          onClick={() => setRoute(route)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group relative w-full flex items-center gap-2.5 pl-5 pr-3 py-2 text-sm text-left cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                            ${isActive
                              ? 'text-accent font-semibold'
                              : 'text-ink-2 hover:text-ink-1 hover:bg-surface-3/60'
                            }`}
                        >
                          <span
                            className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r transition-all duration-200
                              ${isActive ? 'bg-accent' : 'bg-transparent'}`}
                            style={isActive ? { boxShadow: '0 0 10px var(--accent-glow)' } : undefined}
                          />
                          {isActive && (
                            <span className="absolute inset-0 bg-gradient-to-r from-accent/12 to-transparent pointer-events-none" />
                          )}
                          <Icon size={16} strokeWidth={isActive ? 2.25 : 1.9}
                            className={isActive ? 'relative text-accent' : 'relative text-ink-3 group-hover:text-ink-2'} />
                          <span className="relative flex-1 truncate">{label}</span>
                          {badge > 0 && bstyle && (
                            <span
                              className={`relative min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-mono font-semibold ${bstyle.cls} ${bstyle.pulse ? 'animate-pulse-glow' : ''}`}
                              style={bstyle.pulse ? { boxShadow: '0 0 10px rgba(244,63,94,0.6)' } : undefined}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* System status footer */}
        <div className="px-4 py-3 border-t border-edge flex items-center gap-2 text-[10px] text-ink-3">
          <span className="w-1.5 h-1.5 rounded-full bg-e10-prod animate-pulse-soft"
            style={{ boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
          <span className="font-mono">SYSTEM NOMINAL</span>
          <span className="ml-auto font-mono text-ink-mute">v1.0</span>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar clock={clock} operatorCount={operatorCount} />
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary key={activeRoute} moduleName={activeLabel}>
            <Suspense fallback={activeRoute === 'control-tower' ? <ControlTowerSkeleton /> : <ModuleSkeleton />}>
              {renderModule()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
