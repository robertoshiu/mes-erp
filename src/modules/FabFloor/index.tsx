import { useMemo } from 'react'
import { Radio } from 'lucide-react'
import { BayLayout } from './BayLayout'
import { KpiStrip } from './KpiStrip'
import { EventStream } from '../../components/EventStream'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'

interface FabFloorProps {
  eventBus: EventBus
  masterData: MasterData
}

export function FabFloor({ eventBus, masterData }: FabFloorProps) {
  const equipState$ = useMemo(() => eventBus.ofTopic('equip.state'), [eventBus])
  const lotMove$ = useMemo(() => eventBus.ofTopic('lot.move'), [eventBus])
  const kpiTick$ = useMemo(() => eventBus.ofTopic('kpi.tick'), [eventBus])
  const allEvents$ = useMemo(() => eventBus.all$(), [eventBus])

  return (
    <div className="flex h-full gap-4 p-4 bg-canvas">
      {/* Main content: KPI strip on top + floor map filling */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        <KpiStrip kpiTick$={kpiTick$} />

        <Panel className="hud-frame relative flex-1 min-h-0 overflow-hidden">
          <div className="absolute top-3 right-4 z-10 flex items-center gap-2 pointer-events-none">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-3">
              FAB-01 · BAY MAP
            </span>
          </div>
          <div className="h-full w-full p-4">
            <BayLayout equipment={masterData.equipment} equipState$={equipState$} lotMove$={lotMove$} />
          </div>
        </Panel>
      </div>

      {/* Right panel: live event stream */}
      <Panel
        glass
        className="w-80 shrink-0 flex flex-col overflow-hidden"
        aria-label="Event stream"
      >
        <PanelHeader
          title="Live Events"
          icon={<Radio size={15} strokeWidth={1.9} className="animate-pulse-soft" />}
          right={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-success">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                style={{ background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}
                aria-hidden
              />
              Streaming
            </span>
          }
        />
        <div className="flex-1 min-h-0">
          <EventStream events$={allEvents$} />
        </div>
      </Panel>
    </div>
  )
}
