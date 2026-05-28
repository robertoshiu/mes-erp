import { useEffect, useState } from 'react'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { AlarmRaisedEvent } from '../../lib/events'

interface AlarmsModuleProps {
  eventBus: EventBus
}

export function AlarmsModule({ eventBus }: AlarmsModuleProps) {
  const [alarms, setAlarms] = useState<AlarmRaisedEvent[]>([])
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const sub = eventBus.ofTopic('alarm.raised').subscribe(alarm => {
      setAlarms(prev => [alarm, ...prev].slice(0, 100))
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  const selectedAlarm = selectedEntity?.type === 'alarm'
    ? alarms.find(a => a.alarmId === selectedEntity.id)
    : null

  const severityStyle = (sev: string) =>
    sev === 'critical' ? 'bg-[#DC2626] text-white' :
    sev === 'major' ? 'bg-[#B45309] text-white' :
    'bg-[#6B7280] text-white'

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-xs font-semibold text-[#6B7280] mb-2">Alarm Desk &mdash; {alarms.length} alarms</div>
        {alarms.length === 0 && (
          <div className="text-xs text-[#9CA3AF] font-mono py-4">Alarm bus listening...</div>
        )}
        {alarms.map((alarm, i) => (
          <div
            key={`${alarm.alarmId}-${i}`}
            className="flex items-center gap-3 px-3 py-2 border-b border-[#E5E7EB] hover:bg-[#F3F6F9] cursor-pointer"
            onClick={() => selectEntity({ type: 'alarm', id: alarm.alarmId })}
          >
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${severityStyle(alarm.severity)}`}>
              {alarm.severity.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-[#6B7280] w-16 shrink-0">t={alarm.t.toFixed(0)}s</span>
            <span className="font-mono text-xs text-[#6B7280] w-28 shrink-0">{alarm.source}</span>
            <span className="text-xs text-[#303030] flex-1 truncate">{alarm.message}</span>
            {alarm.ackOperatorId && (
              <span className="text-[10px] text-[#16A34A] font-mono">ACK</span>
            )}
          </div>
        ))}
      </div>

      {selectedAlarm && (
        <DrillInPanel title={`Alarm ${selectedAlarm.alarmId}`}>
          <div className="space-y-3 text-xs">
            <div><span className="text-[#6B7280]">Severity:</span> <span className={`px-1.5 py-0.5 rounded-sm ${severityStyle(selectedAlarm.severity)}`}>{selectedAlarm.severity}</span></div>
            <div><span className="text-[#6B7280]">Source:</span> <span className="font-mono">{selectedAlarm.source}</span></div>
            <div><span className="text-[#6B7280]">Message:</span> {selectedAlarm.message}</div>
            {selectedAlarm.sopRef && <div><span className="text-[#6B7280]">SOP Reference:</span> <span className="font-mono text-[#0066B3]">{selectedAlarm.sopRef}</span></div>}
            {selectedAlarm.ackOperatorId && <div><span className="text-[#6B7280]">Acknowledged by:</span> <span className="font-mono">{selectedAlarm.ackOperatorId}</span></div>}
            <div><span className="text-[#6B7280]">Time:</span> <span className="font-mono">t={selectedAlarm.t.toFixed(1)}s</span></div>
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}
