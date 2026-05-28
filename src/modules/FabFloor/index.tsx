import { useMemo } from 'react'
import { BayLayout } from './BayLayout'
import { KpiStrip } from './KpiStrip'
import { EventStream } from '../../components/EventStream'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'

interface FabFloorProps {
  eventBus: EventBus
  masterData: MasterData
}

export function FabFloor({ eventBus, masterData }: FabFloorProps) {
  const equipState$ = useMemo(() => eventBus.ofTopic('equip.state'), [eventBus])
  const kpiTick$ = useMemo(() => eventBus.ofTopic('kpi.tick'), [eventBus])
  const allEvents$ = useMemo(() => eventBus.all$(), [eventBus])

  return (
    <div className="flex h-full">
      {/* Main content: floor layout + KPI strip */}
      <div className="flex-1 flex flex-col min-w-0">
        <KpiStrip kpiTick$={kpiTick$} />
        <div className="flex-1 p-4 overflow-hidden">
          <BayLayout equipment={masterData.equipment} equipState$={equipState$} />
        </div>
      </div>

      {/* Right panel: event stream */}
      <aside className="w-80 border-l border-[#D1D5DB] bg-white" aria-label="Event stream">
        <div className="px-3 py-2 border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
          Live Events
        </div>
        <div className="h-[calc(100%-33px)]">
          <EventStream events$={allEvents$} />
        </div>
      </aside>
    </div>
  )
}
