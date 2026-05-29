import { useMemo, useEffect, useState, type ComponentType } from 'react'
import {
  LayoutGrid, Boxes, Cpu, Activity, ClipboardList, AlertTriangle,
  Gauge as GaugeIcon, Hexagon,
} from 'lucide-react'
import { useUiStore, type ModuleRoute } from './lib/uiStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { FabFloor } from './modules/FabFloor'
import { EquipmentModule } from './modules/Equipment'
import { SpcModule } from './modules/SPC'
import { ProductionModule } from './modules/Production'
import { AlarmsModule } from './modules/Alarms'
import { KpiDashboard } from './modules/KPI'
import { RecipeModule } from './modules/Recipe'
import { generateMasterData } from './data/master'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'
import { createTimelineEngine } from './data/timeline-engine'

// Lazy placeholders — will be replaced with real modules in Day 2-3
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-ink-3 font-mono">
      {name} — awaiting implementation
    </div>
  )
}

type IconCmp = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

interface NavItem {
  route: ModuleRoute
  label: string
  Icon: IconCmp
  badgeKey?: 'alarms' | 'production' | 'equipmentDown'
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operations',
    items: [
      { route: 'fab-floor', label: 'Fab Floor', Icon: LayoutGrid },
      { route: 'production', label: 'Production', Icon: Boxes, badgeKey: 'production' },
      { route: 'equipment', label: 'Equipment', Icon: Cpu, badgeKey: 'equipmentDown' },
    ],
  },
  {
    group: 'Quality',
    items: [
      { route: 'spc', label: 'SPC / Quality', Icon: Activity },
      { route: 'recipe', label: 'Recipe Mgmt', Icon: ClipboardList },
    ],
  },
  {
    group: 'Command',
    items: [
      { route: 'alarms', label: 'Alarms', Icon: AlertTriangle, badgeKey: 'alarms' },
      { route: 'kpi', label: 'KPI Dashboard', Icon: GaugeIcon },
    ],
  },
]

export default function App() {
  const masterData = useMemo(() => generateMasterData(), [])
  const clock = useMemo(() => createClock(), [])
  const eventBus = useMemo(() => createEventBus(), [])
  const engine = useMemo(() => createTimelineEngine(clock, eventBus, masterData), [clock, eventBus, masterData])

  const activeRoute = useUiStore(s => s.activeRoute)
  const setRoute = useUiStore(s => s.setRoute)
  const badges = useUiStore(s => s.badges)

  // Viewport width gate
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Start clock + timeline engine on mount
  useEffect(() => {
    engine.preRoll()
    clock.start()
    engine.start()
    return () => {
      engine.stop()
      clock.destroy()
    }
  }, [clock, engine])

  // Subscribe to shift boundary events
  useEffect(() => {
    const sub = eventBus.ofTopic('shift.boundary').subscribe(e => {
      useUiStore.getState().setShift(e.shiftCode)
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  // Badge count subscription (throttled at 1s)
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
      default: return <Placeholder name={activeRoute} />
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
            <div className="text-[9px] uppercase tracking-[0.28em] text-ink-3">MES · Command</div>
          </div>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group} className="mb-1.5">
              <div className="px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
                {group}
              </div>
              {items.map(({ route, label, Icon, badgeKey }) => {
                const isActive = activeRoute === route
                const badge = badgeKey ? badges[badgeKey] : 0
                const isAlarm = badgeKey === 'alarms'
                return (
                  <button
                    key={route}
                    onClick={() => setRoute(route)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative w-full flex items-center gap-2.5 pl-4 pr-3 py-2 text-sm text-left cursor-pointer transition-all duration-200
                      ${isActive
                        ? 'text-accent font-semibold'
                        : 'text-ink-2 hover:text-ink-1 hover:bg-surface-3/60'
                      }`}
                  >
                    {/* active rail */}
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
                    <span className="relative flex-1">{label}</span>
                    {badge > 0 && (
                      <span
                        className={`relative min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-mono font-semibold
                          ${isAlarm ? 'bg-critical text-white animate-pulse-glow' : 'bg-warn/20 text-warn'}`}
                        style={isAlarm ? { boxShadow: '0 0 10px rgba(244,63,94,0.6)' } : undefined}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
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
            {renderModule()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
