import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, AreaChart, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { Activity, Radio, ScrollText, AlertTriangle, Sigma, Target } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { CHART, ChartDefs, ChartTooltip } from '../../lib/chartTheme'
import { chartSeries } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import type { EventBus } from '../../lib/eventBus'
import type { SpcViolationEvent } from '../../lib/events'

interface SpcModuleProps {
  eventBus: EventBus
}

interface ChartPoint {
  index: number
  value: number
  isViolation: boolean
  ruleNumber?: 1 | 2 | 4
  severity?: string
}

const UCL = 55.0
const LCL = 45.0
const CENTERLINE = 50.0

// Process spec-limit window for the demo: CD target 50 ±6 nm
// (intentionally wider than the ±5 nm control limits above).
const SPEC_USL = 56.0
const SPEC_LSL = 44.0

const ACCENT = chartSeries[0] // cyan
const VIOLATION = '#FB7185' // rose

/** Capability gating color: emerald (capable), amber (marginal), rose (incapable). */
function capColor(v: number): string {
  if (v >= 1.33) return '#34D399'
  if (v >= 1.0) return '#FBBF24'
  return '#F43F5E'
}

/** Custom Recharts dot: glowing rose marker for violations, small cyan node otherwise. */
function SpcDot(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  if (payload?.isViolation) {
    return <circle cx={cx} cy={cy} r={5} fill={VIOLATION} stroke={VIOLATION} filter="url(#fpGlow)" />
  }
  return <circle cx={cx} cy={cy} r={2.5} fill={ACCENT} stroke={ACCENT} />
}

interface StatTileProps {
  label: string
  value: string
  unit?: string
  accent?: string
  glow?: boolean
  icon?: ReactNode
  sub?: string
}

/** Compact stat readout used in the SPC summary row. */
function StatTile({ label, value, unit, accent = '#E8EEF7', glow, icon, sub }: StatTileProps) {
  return (
    <Panel className="px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-ink-3 flex items-center">{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span
          className="metric-value text-[22px] font-semibold leading-none"
          style={{ color: accent, textShadow: glow ? `0 0 16px ${accent}66` : undefined }}
        >
          {value}
        </span>
        {unit && <span className="text-[10px] text-ink-3 mb-0.5 font-mono">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] font-mono text-ink-3 mt-0.5">{sub}</div>}
    </Panel>
  )
}

export function SpcModule({ eventBus }: SpcModuleProps) {
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [violations, setViolations] = useState<SpcViolationEvent[]>([])

  useEffect(() => {
    let idx = 0
    const sub = eventBus.ofTopic('spc.violation').subscribe(e => {
      const isViolation = e.severity === 'warn' || e.severity === 'critical'
      const point: ChartPoint = {
        index: idx++,
        value: e.controlPoint.value,
        isViolation,
        ruleNumber: isViolation ? e.ruleNumber : undefined,
        severity: e.severity,
      }
      setPoints(prev => [...prev.slice(-99), point])
      if (isViolation) {
        setViolations(prev => [e, ...prev].slice(0, 20))
      }
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  const current = points.length > 0 ? points[points.length - 1].value : null
  const lastIsViolation = points.length > 0 ? points[points.length - 1].isViolation : false

  // Process capability (Cp / Cpk) over the current point window.
  const capability = useMemo(() => {
    if (points.length < 8) return null
    const values = points.map(p => p.value)
    const n = values.length
    const mean = values.reduce((acc, v) => acc + v, 0) / n
    const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (n - 1)
    const sigma = Math.sqrt(variance)
    if (!(sigma > 0)) return null
    const cp = (SPEC_USL - SPEC_LSL) / (6 * sigma)
    const cpk = Math.min(SPEC_USL - mean, mean - SPEC_LSL) / (3 * sigma)
    return { cp, cpk, mean, sigma }
  }, [points])

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      {/* Summary stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <StatTile
          label="Current CD"
          value={current != null ? current.toFixed(2) : '—'}
          unit="nm"
          accent={lastIsViolation ? VIOLATION : ACCENT}
          glow
          icon={<Activity size={13} strokeWidth={1.9} />}
        />
        <StatTile
          label="Violations"
          value={violations.length.toString()}
          accent={violations.length > 0 ? VIOLATION : '#E8EEF7'}
          glow={violations.length > 0}
          icon={<AlertTriangle size={13} strokeWidth={1.9} />}
        />
        <StatTile
          label="Cp"
          value={capability ? capability.cp.toFixed(2) : '—'}
          accent={capability ? capColor(capability.cp) : '#AEBBD0'}
          glow={capability != null}
          sub={capability ? 'sigma ' + capability.sigma.toFixed(2) + ' nm' : undefined}
          icon={<Sigma size={13} strokeWidth={1.9} />}
        />
        <StatTile
          label="Cpk"
          value={capability ? capability.cpk.toFixed(2) : '—'}
          accent={capability ? capColor(capability.cpk) : '#AEBBD0'}
          glow={capability != null}
          sub="spec 44-56 nm"
          icon={<Target size={13} strokeWidth={1.9} />}
        />
      </div>

      {/* Control Chart */}
      <Panel className="flex-1 min-h-[280px] flex flex-col">
        <PanelHeader
          title="SPC Control Chart · CD Uniformity (nm)"
          icon={<Activity size={15} strokeWidth={1.9} />}
          right={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
              <Radio size={12} strokeWidth={1.9} className="animate-pulse-soft" />
              Live
            </span>
          }
        />
        <div className="flex-1 p-3.5 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 24, bottom: 6, left: 4 }}>
              <ChartDefs />
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="index" stroke={CHART.axis} tick={CHART.tick} />
              <YAxis domain={[40, 60]} stroke={CHART.axis} tick={CHART.tick} />
              <Tooltip content={<ChartTooltip unit=" nm" />} />
              <ReferenceLine
                y={UCL}
                stroke={VIOLATION}
                strokeDasharray="8 4"
                label={{ value: 'UCL', fill: VIOLATION, fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                y={LCL}
                stroke={VIOLATION}
                strokeDasharray="8 4"
                label={{ value: 'LCL', fill: VIOLATION, fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                y={CENTERLINE}
                stroke={ACCENT}
                strokeDasharray="4 4"
                label={{ value: 'CL', fill: ACCENT, fontSize: 10, position: 'right' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={ACCENT}
                strokeWidth={2}
                fill="url(#fpArea0)"
                filter="url(#fpGlow)"
                isAnimationActive={false}
                dot={<SpcDot />}
                activeDot={{ r: 4, fill: ACCENT, stroke: ACCENT }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Violation Log */}
      <Panel className="shrink-0 flex flex-col max-h-56">
        <PanelHeader
          title="Violation Log"
          icon={<ScrollText size={15} strokeWidth={1.9} />}
          right={
            <span className="font-mono text-[11px] text-ink-3 tabular-nums">{violations.length}</span>
          }
        />
        <div className="flex-1 overflow-y-auto px-3.5 py-2 min-h-0">
          {violations.length === 0 && (
            <div className="text-xs text-ink-3 font-mono py-3">No violations detected</div>
          )}
          {violations.map((v, i) => {
            const isCritical = v.severity === 'critical'
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-sm border-b border-edge last:border-b-0',
                  isCritical && 'bg-critical/10',
                )}
              >
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0',
                    isCritical ? 'bg-critical text-white' : 'bg-warn/20 text-warn',
                  )}
                >
                  {v.severity}
                </span>
                <span className="font-mono text-[11px] text-ink-3 tabular-nums w-16 shrink-0">
                  t={v.t.toFixed(0)}s
                </span>
                <span className="text-xs text-ink-1 flex-1 truncate">
                  Rule {v.ruleNumber}
                  <span className="text-ink-3"> &middot; </span>
                  <span className="font-mono">{v.controlPoint.value.toFixed(2)} nm</span>
                </span>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
