import { useMemo, useEffect, useState } from 'react'
import { useUiStore, type ModuleRoute } from './lib/uiStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { generateMasterData } from './data/master'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'

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
  const eventBus = useMemo(() => createEventBus(1000), [])

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

  // Start clock on mount
  useEffect(() => {
    clock.start()
    return () => clock.destroy()
  }, [clock])

  // Count on-shift operators
  const operatorCount = useMemo(() => {
    const shift = useUiStore.getState().currentShift
    return masterData.operators.filter(op => op.shift === shift).length
  }, [masterData])

  const renderModule = () => {
    switch (activeRoute) {
      case 'fab-floor': return <Placeholder name="FabFloor" />
      case 'production': return <Placeholder name="Production" />
      case 'equipment': return <Placeholder name="Equipment" />
      case 'spc': return <Placeholder name="SPC" />
      case 'recipe': return <Placeholder name="Recipe" />
      case 'alarms': return <Placeholder name="Alarms" />
      case 'kpi': return <Placeholder name="KPI" />
    }
  }

  if (windowWidth < 1280) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F3F6F9] p-8 text-center">
        <div>
          <div className="text-sm text-[#6B7280]">
            FabPulse requires a viewport of 1280px or wider.
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
          <ErrorBoundary moduleName={activeRoute}>
            {renderModule()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
