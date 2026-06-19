import { useMemo } from 'react'
import { Radio, Factory } from 'lucide-react'
import { BayLayout } from './BayLayout'
import { KpiStrip } from './KpiStrip'
import { EventStream } from '../../components/EventStream'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { TickerTape } from '../../components/ui/TickerTape'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'

interface FabFloorProps {
  eventBus: EventBus
  masterData: MasterData
}

export function FabFloor({ eventBus, masterData }: FabFloorProps) {
  const equipState$ = useMemo(() => eventBus.ofTopic('equip.state'), [eventBus])
  const lotMove$ = useMemo(() => eventBus.ofTopic('lot.move'), [eventBus])
  const allEvents$ = useMemo(() => eventBus.all$(), [eventBus])
  // Snapshot the ring buffer at mount so the stream backfills with recent
  // history instead of starting blank when navigating in after the sim has run.
  const seedEvents = useMemo(() => eventBus.getBuffer(), [eventBus])

  return (
    <div className="relative flex h-full gap-4 p-4 bg-canvas">
      {/* Ambient bloom is a decorative child of this relative container — NOT a
          class on the root. As a class, `.bg-bloom` (position:absolute; inset:0;
          pointer-events:none) made the whole module absolute-to-the-viewport,
          overlaying the TopBar + sidebar, and made all content click-through. */}
      <div className="bg-bloom" aria-hidden />
      {/* Main content: command header + KPI strip + throughput ticker, floor map filling */}
      <div className="relative z-[1] flex-1 flex flex-col min-w-0 gap-4">
        <ModuleHeader
          title="Fab Floor"
          subtitle="FAB-01 · live process command center"
          domain="MES"
          icon={<Factory size={13} strokeWidth={2} />}
          pills={[{ label: 'Tools', value: masterData.equipment.length, tone: 'accent' }]}
          right={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-success">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                style={{ background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}
                aria-hidden
              />
              Live
            </span>
          }
        />

        <KpiStrip eventBus={eventBus} totalEquipment={masterData.equipment.length} />

        {/* Thin throughput ticker — lot moves + completions sliding through. */}
        <Panel className="shrink-0 px-2 py-1 flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center gap-1.5 pl-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            <Radio size={11} strokeWidth={2} className="text-accent animate-pulse-soft" />
            Throughput
          </span>
          <div className="min-w-0 flex-1">
            <TickerTape source$={allEvents$} accept={['lot.move', 'lot.complete']} max={28} />
          </div>
        </Panel>

        <Panel className="hud-frame relative flex-1 min-h-0 overflow-hidden" data-tour="fab-floor.bay-map">
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
        className="relative z-[1] w-80 shrink-0 flex flex-col overflow-hidden"
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
          <EventStream events$={allEvents$} seed={seedEvents} />
        </div>
      </Panel>
    </div>
  )
}
