import { useMemo, useEffect, useState, lazy, Suspense, type ComponentType } from 'react'
import {
  LayoutGrid, Boxes, Cpu, Activity, ClipboardList, AlertTriangle, Gauge as GaugeIcon, Hexagon,
  Network, CalendarRange, ShoppingCart, Factory, Warehouse, Truck, Package, Building2, ListTree, Landmark,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useUiStore, type ModuleRoute, type BadgeCounts } from './lib/uiStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { generateMasterData } from './data/master'
import { generateErpData } from './data/erp'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'
import { createTimelineEngine } from './data/timeline-engine'
import { createErpTimelineEngine } from './data/erp/erp-timeline-engine'
import { createBridge } from './data/erp/bridge'

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

type IconCmp = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

interface NavItem {
  route: ModuleRoute
  label: string
  Icon: IconCmp
  badgeKey?: keyof BadgeCounts
}

interface NavGroup { group: string; items: NavItem[] }
interface NavDomain { domain: string; groups: NavGroup[] }

const DOMAINS: NavDomain[] = [
  {
    domain: 'MES',
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
]

// Badge color by semantic: alarms/shortages = critical pulse, late/down = warn, counts = accent.
function badgeClass(key: keyof BadgeCounts): { cls: string; pulse: boolean } {
  if (key === 'alarms' || key === 'shortages') return { cls: 'bg-critical text-white', pulse: true }
  if (key === 'equipmentDown' || key === 'latePOs') return { cls: 'bg-warn/20 text-warn', pulse: false }
  return { cls: 'bg-accent/15 text-accent', pulse: false }
}

function ModuleSkeleton() {
  return (
    <div className="h-full p-4">
      <div className="panel h-full w-full animate-pulse-soft" />
    </div>
  )
}

export default function App() {
  const masterData = useMemo(() => generateMasterData(), [])
  const erpData = useMemo(() => generateErpData(masterData), [masterData])
  const clock = useMemo(() => createClock(), [])
  const eventBus = useMemo(() => createEventBus(), [])
  const engine = useMemo(() => createTimelineEngine(clock, eventBus, masterData), [clock, eventBus, masterData])
  const erpEngine = useMemo(() => createErpTimelineEngine(clock, eventBus, erpData), [clock, eventBus, erpData])
  const bridge = useMemo(() => createBridge(clock, eventBus, masterData, erpData), [clock, eventBus, masterData, erpData])

  const activeRoute = useUiStore(s => s.activeRoute)
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

  // Start clock + MES/ERP engines + bridge on mount
  useEffect(() => {
    engine.preRoll()
    erpEngine.preRoll()
    clock.start()
    bridge.start()        // subscribe before the ERP engine releases orders
    engine.start()
    erpEngine.start()
    return () => {
      erpEngine.stop()
      engine.stop()
      bridge.stop()
      clock.destroy()
    }
  }, [clock, engine, erpEngine, bridge])

  // Subscribe to shift boundary events
  useEffect(() => {
    const sub = eventBus.ofTopic('shift.boundary').subscribe(e => {
      useUiStore.getState().setShift(e.shiftCode)
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  // Static ERP badge counts (derived from the seeded ERP dataset).
  useEffect(() => {
    const shortages = erpData.inventory.filter(r => r.available <= 0).length
    const openOrders = erpData.salesOrders.filter(o => o.status === 'open' || o.status === 'in-process').length
    const latePOs = erpData.purchaseOrders.filter(p => p.status === 'late').length
    useUiStore.getState().updateBadges({ shortages, openOrders, latePOs })
  }, [erpData])

  // MES badge counts (throttled at 1s)
  useEffect(() => {
    let alarmCount = 0
    let lotCount = 0
    let downCount = 0
    const sub = eventBus.all$().subscribe(e => {
      if (e.topic === 'alarm.raised' && !e.ackOperatorId) alarmCount++
      if (e.topic === 'alarm.raised' && e.ackOperatorId) alarmCount = Math.max(0, alarmCount - 1)
      if (e.topic === 'lot.move') lotCount = masterData.lots.filter(l => l.status === 'in-process').length
      if (e.topic === 'equip.state' && (e.toState === 'SDT' || e.toState === 'UDT')) downCount++
      if (e.topic === 'equip.state' && e.fromState !== 'PROD' && e.toState === 'PROD') downCount = Math.max(0, downCount - 1)
    })
    const throttle = setInterval(() => {
      useUiStore.getState().updateBadges({ alarms: alarmCount, production: lotCount, equipmentDown: downCount })
    }, 1000)
    return () => { sub.unsubscribe(); clearInterval(throttle) }
  }, [eventBus, masterData])

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
            <div className="text-[9px] uppercase tracking-[0.28em] text-ink-3">MES · ERP</div>
          </div>
        </div>

        {/* Nav: MES + ERP domains, collapsible groups */}
        <div className="flex-1 overflow-y-auto py-2">
          {DOMAINS.map(({ domain, groups }) => (
            <div key={domain} className="mb-1.5">
              <div className="px-4 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.26em] text-accent/70">
                {domain}
              </div>
              {groups.map(({ group, items }) => {
                const gkey = `${domain}:${group}`
                const isCollapsed = collapsed.has(gkey)
                return (
                  <div key={gkey} className="mb-0.5">
                    <button
                      onClick={() => toggleGroup(gkey)}
                      className="group/g w-full flex items-center gap-1 px-4 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-mute hover:text-ink-3 cursor-pointer transition-colors"
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
                          className={`group relative w-full flex items-center gap-2.5 pl-5 pr-3 py-2 text-sm text-left cursor-pointer transition-all duration-200
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
          <ErrorBoundary key={activeRoute} moduleName={activeRoute}>
            <Suspense fallback={<ModuleSkeleton />}>
              {renderModule()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
