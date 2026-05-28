import { useMemo, useEffect, useState } from 'react'
import { useUiStore, type ModuleRoute } from './lib/uiStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { FabFloor } from './modules/FabFloor'
import { EquipmentModule } from './modules/Equipment'
import { SpcModule } from './modules/SPC'
import { generateMasterData } from './data/master'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'
import { createTimelineEngine } from './data/timeline-engine'

// Lazy placeholders — will be replaced with real modules in Day 2-3
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-[#6B7280] font-mono">
      {name} — awaiting implementation
    </div>
  )
}

const NAV_ITEMS: { route: ModuleRoute; label: string; icon: string; badgeKey?: 'alarms' | 'production' | 'equipmentDown' }[] = [
  { route: 'fab-floor', label: 'Fab Floor', icon: '◉' },
  { route: 'production', label: 'Production', icon: '▦', badgeKey: 'production' },
  { route: 'equipment', label: 'Equipment', icon: '⚙', badgeKey: 'equipmentDown' },
  { route: 'spc', label: 'SPC / Quality', icon: '📈' },
  { route: 'recipe', label: 'Recipe Mgmt', icon: '📋' },
  { route: 'alarms', label: 'Alarms', icon: '⚠', badgeKey: 'alarms' },
  { route: 'kpi', label: 'KPI Dashboard', icon: '▣' },
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
      case 'production': return <Placeholder name="Production" />
      case 'equipment': return <EquipmentModule eventBus={eventBus} masterData={masterData} />
      case 'spc': return <SpcModule eventBus={eventBus} />
      case 'recipe': return <Placeholder name="Recipe" />
      case 'alarms': return <Placeholder name="Alarms" />
      case 'kpi': return <Placeholder name="KPI" />
      default: return <Placeholder name={activeRoute} />
    }
  }

  if (windowWidth < 1280) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F3F6F9] p-8 text-center">
        <div>
          <div className="text-sm text-[#6B7280]">
            FabPulse requires a viewport &ge; 1280px. Open on a desktop or rotate your tablet.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F3F6F9] font-sans">
      {/* Sidebar */}
      <nav className="w-52 bg-white border-r border-[#D1D5DB] flex flex-col" aria-label="Module navigation">
        <div className="p-4 border-b border-[#E5E7EB]">
          <span className="text-lg font-semibold text-[#0066B3]">FabPulse</span>
        </div>
        <div className="flex-1 py-2">
          {NAV_ITEMS.map(item => {
            const isActive = activeRoute === item.route
            const badge = item.badgeKey ? badges[item.badgeKey] : 0
            return (
              <button
                key={item.route}
                onClick={() => setRoute(item.route)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors
                  ${isActive
                    ? 'bg-[#0066B3] bg-opacity-10 text-[#0066B3] font-semibold border-r-2 border-[#0066B3]'
                    : 'text-[#303030] hover:bg-[#F3F6F9]'
                  }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono
                    ${item.badgeKey === 'alarms' ? 'bg-[#DC2626] text-white' : 'bg-[#F59E0B] text-white'}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
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
