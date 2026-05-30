import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, ShieldAlert, Radio, ShieldCheck, ChevronRight, Siren } from 'lucide-react'
import { DrillInPanel } from '../../components/DrillInPanel'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import type { EventBus } from '../../lib/eventBus'
import type { AlarmRaisedEvent } from '../../lib/events'
import type { Clock } from '../../lib/clock'

interface AlarmsModuleProps {
  eventBus: EventBus
  clock: Clock
}

type Severity = AlarmRaisedEvent['severity']

/** Visual config per severity — chip colors, rail, and label tone. */
const SEVERITY: Record<Severity, {
  label: string
  chip: string
  rail: string
  dot: string
  count: string
}> = {
  critical: {
    label: 'CRITICAL',
    chip: 'bg-critical text-white animate-pulse-soft',
    rail: 'before:bg-critical',
    dot: 'bg-critical',
    count: 'text-critical',
  },
  major: {
    label: 'MAJOR',
    chip: 'bg-warn/20 text-warn border border-warn/30',
    rail: 'before:bg-warn/60',
    dot: 'bg-warn',
    count: 'text-warn',
  },
  minor: {
    label: 'MINOR',
    chip: 'bg-surface-3 text-ink-3 border border-edge',
    rail: 'before:bg-ink-mute',
    dot: 'bg-ink-3',
    count: 'text-ink-3',
  },
}

/** Severity summary chip for the header strip. */
function SeverityChip({
  severity,
  count,
}: {
  severity: Severity
  count: number
}) {
  const s = SEVERITY[severity]
  const pinging = severity === 'critical' && count > 0
  return (
    <div className="flex items-center gap-2 rounded-md border border-edge bg-surface-3/40 px-2.5 py-1.5">
      <span className="relative inline-flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
        {pinging && (
          <>
            <span className="absolute inset-0 rounded-full border border-critical animate-sonar" />
            <span
              className="absolute inset-0 rounded-full border border-critical animate-sonar"
              style={{ animationDelay: '0.9s' }}
            />
          </>
        )}
        <span
          className={cn(
            'relative h-2 w-2 rounded-full',
            s.dot,
            pinging && 'animate-pulse-soft',
          )}
        />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {s.label}
      </span>
      <span className={cn('metric-value text-sm leading-none', s.count)}>{count}</span>
    </div>
  )
}

export function AlarmsModule({ eventBus, clock }: AlarmsModuleProps) {
  // Backfill from the bus ring buffer on mount so the desk immediately shows the
  // alarms that already lit the sidebar badge — otherwise the feed starts empty
  // and (since alarms are rare/scripted) the user waits a long time for the next
  // one, which reads as "slow to load" and disconnected from the badge count.
  // Fold BOTH alarm.raised and alarm.ack (oldest→newest) so an alarm acked in a
  // previous mount seeds with its ackOperatorId set — matching the sidebar badge,
  // which is recomputed from the same buffer.
  const [alarms, setAlarms] = useState<AlarmRaisedEvent[]>(() => {
    const acked = new Map<string, string>()
    for (const e of eventBus.getBuffer()) {
      if (e.topic === 'alarm.ack') acked.set(e.alarmId, e.operatorId)
    }
    return (eventBus.getBuffer().filter(e => e.topic === 'alarm.raised') as AlarmRaisedEvent[])
      .slice(-100)
      .reverse()
      .map(a => (acked.has(a.alarmId) ? { ...a, ackOperatorId: acked.get(a.alarmId) } : a))
  })
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const raised = eventBus.ofTopic('alarm.raised').subscribe(alarm => {
      setAlarms(prev => [alarm, ...prev].slice(0, 100))
    })
    const acked = eventBus.ofTopic('alarm.ack').subscribe(e => {
      setAlarms(prev =>
        prev.map(a => (a.alarmId === e.alarmId ? { ...a, ackOperatorId: e.operatorId } : a)),
      )
    })
    return () => {
      raised.unsubscribe()
      acked.unsubscribe()
    }
  }, [eventBus])

  const selectedAlarm = selectedEntity?.type === 'alarm'
    ? alarms.find(a => a.alarmId === selectedEntity.id)
    : null

  const counts = {
    critical: alarms.filter(a => a.severity === 'critical').length,
    major: alarms.filter(a => a.severity === 'major').length,
    minor: alarms.filter(a => a.severity === 'minor').length,
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {/* Header strip — alarm desk + severity summary */}
        <Panel className="shrink-0">
          <PanelHeader
            title="Alarm Desk"
            subtitle="Live alarm.raised stream"
            icon={<BellRing size={15} strokeWidth={1.9} />}
            right={
              <div className="flex items-center gap-2.5">
                {counts.critical > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md border border-critical/30 bg-critical/10 px-2 py-1">
                    <span className="relative inline-flex h-4 w-4 items-center justify-center">
                      <span
                        className="absolute inset-0 rounded-full border border-critical animate-sonar"
                        aria-hidden
                      />
                      <span
                        className="absolute inset-0 rounded-full border border-critical animate-sonar"
                        style={{ animationDelay: '0.9s' }}
                        aria-hidden
                      />
                      <Siren size={13} strokeWidth={2} className="relative text-critical" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-critical">
                      Critical
                    </span>
                    <span className="metric-value text-sm leading-none text-critical">
                      {counts.critical}
                    </span>
                  </div>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Total</span>
                <span className="metric-value text-sm text-ink-1">{alarms.length}</span>
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3">
            <SeverityChip severity="critical" count={counts.critical} />
            <SeverityChip severity="major" count={counts.major} />
            <SeverityChip severity="minor" count={counts.minor} />
          </div>
        </Panel>

        {/* Alarm rows */}
        <Panel className="overflow-hidden">
          {alarms.length === 0 ? (
            <div className="flex items-center gap-2.5 px-3.5 py-8 text-ink-3">
              <Radio size={15} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
              <span className="font-mono text-xs">Alarm bus listening...</span>
            </div>
          ) : (
            alarms.map((alarm) => {
              const s = SEVERITY[alarm.severity]
              const selected = selectedAlarm?.alarmId === alarm.alarmId
              return (
                <button
                  key={`${alarm.alarmId}-${alarm.t}`}
                  type="button"
                  onClick={() => selectEntity({ type: 'alarm', id: alarm.alarmId })}
                  className={cn(
                    'group relative flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left',
                    'cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
                    s.rail,
                    selected ? 'bg-accent/10' : 'hover:bg-surface-3/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex w-[64px] shrink-0 items-center justify-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
                      s.chip,
                    )}
                  >
                    {alarm.severity.toUpperCase()}
                  </span>
                  <span className="metric-value w-16 shrink-0 text-xs text-ink-3">
                    t={alarm.t.toFixed(0)}s
                  </span>
                  <span className="w-28 shrink-0 truncate font-mono text-xs text-ink-3">
                    {alarm.source}
                  </span>
                  <span className="flex-1 truncate text-xs text-ink-1">{alarm.message}</span>
                  {alarm.ackOperatorId && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      <ShieldCheck size={11} strokeWidth={2} />
                      ACK
                    </span>
                  )}
                  <ChevronRight
                    size={14}
                    strokeWidth={1.9}
                    className="shrink-0 text-ink-mute transition-colors duration-150 group-hover:text-accent"
                  />
                </button>
              )
            })
          )}
        </Panel>
      </div>

      {selectedAlarm && (
        <DrillInPanel title={`Alarm ${selectedAlarm.alarmId}`} subtitle={selectedAlarm.source}>
          <div className="space-y-3">
            {/* Severity banner */}
            <div className="flex items-center gap-2.5 rounded-md border border-edge bg-surface-3/40 px-3 py-2.5">
              <span className="text-accent">
                {selectedAlarm.severity === 'critical' ? (
                  <ShieldAlert size={16} strokeWidth={1.9} className="text-critical" />
                ) : selectedAlarm.severity === 'major' ? (
                  <AlertTriangle size={16} strokeWidth={1.9} className="text-warn" />
                ) : (
                  <AlertTriangle size={16} strokeWidth={1.9} className="text-ink-3" />
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide',
                  SEVERITY[selectedAlarm.severity].chip,
                )}
              >
                {selectedAlarm.severity.toUpperCase()}
              </span>
            </div>

            <DetailRow label="Source" value={selectedAlarm.source} mono />
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Message
              </div>
              <div className="text-xs leading-relaxed text-ink-1">{selectedAlarm.message}</div>
            </div>
            {selectedAlarm.sopRef && (
              <DetailRow label="SOP Reference" value={selectedAlarm.sopRef} accent mono />
            )}
            {selectedAlarm.ackOperatorId && (
              <DetailRow label="Acknowledged By" value={selectedAlarm.ackOperatorId} mono />
            )}
            <DetailRow label="Time" value={`t=${selectedAlarm.t.toFixed(1)}s`} mono />

            {selectedAlarm.ackOperatorId ? (
              <div className="flex items-center justify-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-xs font-medium text-success">
                <ShieldCheck size={14} strokeWidth={2} />
                ACK by {selectedAlarm.ackOperatorId}
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  eventBus.publish({
                    topic: 'alarm.ack',
                    t: clock.loopT(),
                    alarmId: selectedAlarm.alarmId,
                    operatorId: 'OP-001',
                    severity: selectedAlarm.severity,
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 hover:border-accent/60 cursor-pointer glow-cyan"
              >
                <ShieldCheck size={14} strokeWidth={2} />
                Acknowledge
              </button>
            )}
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}

/** A labeled key/value row for the drill-in detail panel. */
function DetailRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <span
        className={cn(
          'text-right text-xs',
          mono && 'font-mono',
          accent ? 'text-accent text-glow-soft' : 'text-ink-1',
        )}
      >
        {value}
      </span>
    </div>
  )
}
