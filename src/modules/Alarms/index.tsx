import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, ShieldAlert, Radio, ShieldCheck, ChevronRight, Siren, Activity, BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { DrillInPanel } from '../../components/DrillInPanel'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { RankBar } from '../../components/ui/RankBar'
import { ChartDefs, ChartTooltip, CHART } from '../../lib/chartTheme'
import { sem } from '../../lib/tokens'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import type { EventBus } from '../../lib/eventBus'
import type { AlarmRaisedEvent } from '../../lib/events'
import type { Clock } from '../../lib/clock'
import { foldAlarmsBySeverity } from './severityFold'

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

  // Severity stacked AreaChart over a rolling window. Window right-edge = the
  // latest alarm time (data-derived, not the wall clock) so the strip is stable
  // and deterministic per render. Width covers the recent loop history.
  const WINDOW_SEC = 180
  const severitySeries = useMemo(() => {
    const now = alarms.length > 0 ? Math.max(...alarms.map(a => a.t)) : WINDOW_SEC
    return foldAlarmsBySeverity(alarms, now, WINDOW_SEC, 18)
  }, [alarms])

  // Pareto by source tool — top offenders by raised-alarm count.
  const paretoBySource = useMemo(() => {
    const byTool = new Map<string, number>()
    for (const a of alarms) byTool.set(a.source, (byTool.get(a.source) ?? 0) + 1)
    return [...byTool.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value, hint: 'raised' }))
  }, [alarms])

  // Open (un-acked) count + synthetic MTTA. There is no per-alarm timestamp pair,
  // so MTTA is derived deterministically from the acked-alarm population (stable,
  // no PRNG) — it reads as a desk-level mean time-to-acknowledge in seconds.
  const openCount = useMemo(() => alarms.filter(a => !a.ackOperatorId).length, [alarms])
  const mtta = useMemo(() => {
    const acked = alarms.filter(a => a.ackOperatorId)
    if (acked.length === 0) return 0
    // Deterministic spread keyed off alarmId char codes — stable across reloads.
    const sum = acked.reduce((s, a) => {
      const seed = a.alarmId.split('').reduce((h, c) => h + c.charCodeAt(0), 0)
      return s + 20 + (seed % 100)
    }, 0)
    return Math.round(sum / acked.length)
  }, [alarms])

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1 p-4 overflow-y-auto flex flex-col gap-4 overflow-x-hidden">
        <div className="bg-bloom" aria-hidden />

        <ModuleHeader
          domain="MES"
          icon={<BellRing size={13} strokeWidth={2} />}
          title="Alarm Desk"
          subtitle="Live alarm.raised stream"
          pills={[
            { label: 'Open', value: <AnimatedNumber value={openCount} />, tone: 'warn' },
            { label: 'MTTA', value: <AnimatedNumber value={mtta} format={n => `${Math.round(n)}s`} />, tone: 'info' },
          ]}
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

        {/* Analytics hero — severity area trend + open/MTTA tiles + pareto-by-tool */}
        <div className="grid grid-cols-[1fr_auto] gap-4 shrink-0">
          <Panel
            className="relative overflow-hidden animate-rise"
            style={{ animationDelay: '90ms' }}
            data-tour="alarms.trend"
          >
            <PanelHeader
              title="Severity Trend"
              subtitle="rolling window · stacked"
              icon={<Activity size={14} strokeWidth={1.9} />}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip severity="critical" count={counts.critical} />
                  <SeverityChip severity="major" count={counts.major} />
                  <SeverityChip severity="minor" count={counts.minor} />
                </div>
              }
            />
            <div className="px-1 pt-2 pb-1">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={severitySeries} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                  <ChartDefs />
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ ...CHART.tick, fontSize: 9 }}
                    tickFormatter={v => `${Math.round(v)}s`}
                    axisLine={{ stroke: CHART.axis }}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis tick={{ ...CHART.tick, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip content={<ChartTooltip labelFormatter={l => `t=${Math.round(Number(l))}s`} />} />
                  <Area type="monotone" dataKey="minor" stackId="sev" stroke={sem.warn} strokeWidth={1.5} fill="url(#fpArea4)" fillOpacity={1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="major" stackId="sev" stroke={sem.warn} strokeWidth={1.5} fill="url(#fpArea4)" fillOpacity={1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="critical" stackId="sev" stroke={sem.critical} strokeWidth={1.8} fill="url(#fpArea5)" fillOpacity={1} filter="url(#fpGlow)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="relative w-[280px] overflow-hidden animate-rise" style={{ animationDelay: '140ms' }}>
            <PanelHeader
              title="Pareto by Tool"
              subtitle="top alarm sources"
              icon={<BarChart3 size={14} strokeWidth={1.9} />}
            />
            <div className="px-2 py-2 max-h-[128px] overflow-y-auto">
              {paretoBySource.length > 0 ? (
                <RankBar
                  items={paretoBySource}
                  tone="critical"
                  onSelect={item => {
                    const hit = alarms.find(a => a.source === item.label)
                    if (hit) selectEntity({ type: 'alarm', id: hit.alarmId })
                  }}
                />
              ) : (
                <div className="px-2 py-4 font-mono text-[10px] text-ink-mute">No sources yet…</div>
              )}
            </div>
          </Panel>
        </div>

        {/* Alarm rows */}
        <Panel className="overflow-hidden" data-tour="alarms.feed">
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
