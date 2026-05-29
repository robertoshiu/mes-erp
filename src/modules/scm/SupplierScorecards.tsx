import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { BadgeCheck, Clock, ShieldCheck, Timer, TruckIcon, AlertTriangle } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { Gauge } from '../../components/ui/Gauge'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { mulberry32 } from '../../data/prng'
import { sem } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import type { ScmModuleProps } from './types'
import type { SupplierScorecard } from '../../data/scm/types'

// SCM domain accent (indigo) — pins the screen identity to the locked token.
const ACCENT_3 = '#818CF8'

// Lower bound past which a percentage gauge is no longer "healthy".
const PCT_HEALTHY = 95
const PCT_WARN = 85

// Lead-days thresholds (lower-is-better): a long lead time must read rose.
const LEAD_HEALTHY = 14
const LEAD_WARN = 30

/** Color-gate a higher-is-better metric: emerald >=95, amber >=85, rose below.
 *  Mirrors the SPC `capColor()` cut-point pattern. */
function capColor(v: number): string {
  if (v >= PCT_HEALTHY) return sem.success
  if (v >= PCT_WARN) return sem.warn
  return sem.critical
}

/** Color-gate a lower-is-better metric (lead-days): a short lead reads emerald,
 *  a long one reads rose — the explicit direction the plan calls out so a
 *  lengthy lead time never glows green on the default cyan Gauge. */
function capColorLowerBetter(v: number): string {
  if (v <= LEAD_HEALTHY) return sem.success
  if (v <= LEAD_WARN) return sem.warn
  return sem.critical
}

/** A supplier is at-risk when any of its three gauges falls below healthy. */
function isAtRisk(s: SupplierScorecard): boolean {
  return s.onTimePct < PCT_HEALTHY || s.qualityPct < PCT_HEALTHY || s.avgLeadDays > LEAD_HEALTHY
}

/** Deterministic 12-point trend tail for a metric, seeded off the supplier id +
 *  metric so it never uses the runtime PRNG or wall-clock; the series settles on
 *  the live value (last point) and wanders gently before it. */
function trendSeries(bpNo: string, metric: number, salt: number): number[] {
  let seed = salt
  for (let i = 0; i < bpNo.length; i++) seed = (seed * 31 + bpNo.charCodeAt(i)) >>> 0
  const rng = mulberry32(seed)
  const pts: number[] = []
  for (let i = 0; i < 11; i++) pts.push(metric + (rng() - 0.5) * Math.max(2, metric * 0.06))
  pts.push(metric)
  return pts
}

/** Compact glowing trend sparkline (mirrors MetricTile's inline area spark). */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const series = data.map((v, i) => ({ i, v }))
  const gid = `scs-${color.replace('#', '')}`
  return (
    <div className="h-8 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** One supplier card: name header + three radial gauges + a trend sparkline.
 *  `.panel-hover` lifts on hover; the whole card opens the dense drill-in. */
function ScorecardCard({
  card,
  selected,
  onSelect,
}: {
  card: SupplierScorecard
  selected: boolean
  onSelect: () => void
}) {
  const atRisk = isAtRisk(card)
  const onTimeColor = capColor(card.onTimePct)
  const qualityColor = capColor(card.qualityPct)
  const leadColor = capColorLowerBetter(card.avgLeadDays)
  const spark = useMemo(
    () => trendSeries(card.bpNo, card.onTimePct, 7),
    [card.bpNo, card.onTimePct],
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'panel panel-hover relative overflow-hidden p-4 flex flex-col gap-3 text-left cursor-pointer',
        selected && 'glow-cyan',
        atRisk && 'row-hot',
      )}
    >
      {/* Header: name + vendor no + at-risk flag */}
      <div className="flex items-center gap-2.5">
        <span className="accent-tick self-stretch min-h-[20px]" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-ink-1 truncate">{card.name}</div>
          <div className="text-[10px] font-mono text-ink-3 truncate">{card.bpNo}</div>
        </div>
        {atRisk ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-critical">
            <AlertTriangle size={12} strokeWidth={2.2} />
            At risk
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
            <ShieldCheck size={12} strokeWidth={2.2} />
            Healthy
          </span>
        )}
      </div>

      {/* Three radial gauges */}
      <div className="grid grid-cols-3 gap-1 place-items-center">
        <Gauge
          value={card.onTimePct}
          max={100}
          size={72}
          stroke={7}
          color={onTimeColor}
          valueText={`${Math.round(card.onTimePct)}%`}
          label="On-Time"
        />
        <Gauge
          value={card.qualityPct}
          max={100}
          size={72}
          stroke={7}
          color={qualityColor}
          valueText={`${Math.round(card.qualityPct)}%`}
          label="Quality"
        />
        <Gauge
          value={card.avgLeadDays}
          max={45}
          size={72}
          stroke={7}
          color={leadColor}
          valueText={`${Math.round(card.avgLeadDays)}d`}
          label="Lead"
        />
      </div>

      {/* Trend sparkline + open-ASN count */}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute mb-0.5">
            On-time trend
          </div>
          <Sparkline data={spark} color={onTimeColor} />
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute">Open ASNs</div>
          <div className="metric-value text-lg font-semibold leading-none text-ink-1 tabular-nums">
            {card.openAsns}
          </div>
        </div>
      </div>

      {/* Corner bloom keyed to the worst-of-the-three tone */}
      <span
        className="pointer-events-none absolute -right-8 -bottom-10 w-28 h-28 rounded-full opacity-15 blur-3xl"
        style={{ background: atRisk ? sem.critical : ACCENT_3 }}
        aria-hidden
      />
    </button>
  )
}

/** Dense drill-in detail for a single supplier scorecard. */
function ScorecardDetail({ card }: { card: SupplierScorecard }) {
  const atRisk = isAtRisk(card)
  const rows: { label: string; value: string; color: string; icon: React.ReactNode }[] = [
    {
      label: 'On-Time Delivery',
      value: `${card.onTimePct.toFixed(1)}%`,
      color: capColor(card.onTimePct),
      icon: <Clock size={13} strokeWidth={1.9} />,
    },
    {
      label: 'Quality (PPM-pass)',
      value: `${card.qualityPct.toFixed(1)}%`,
      color: capColor(card.qualityPct),
      icon: <ShieldCheck size={13} strokeWidth={1.9} />,
    },
    {
      label: 'Avg Lead Time',
      value: `${card.avgLeadDays.toFixed(1)} d`,
      color: capColorLowerBetter(card.avgLeadDays),
      icon: <Timer size={13} strokeWidth={1.9} />,
    },
    {
      label: 'Open ASNs',
      value: `${card.openAsns}`,
      color: ACCENT_3,
      icon: <TruckIcon size={13} strokeWidth={1.9} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {atRisk && (
        <div className="row-hot flex items-center gap-2 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
          <AlertTriangle size={14} strokeWidth={2} />
          At-risk supplier — one or more metrics below target. Expedite open ASNs.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {rows.map(r => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 rounded-md border border-edge bg-surface-3/40 px-3 py-2.5"
          >
            <span className="flex items-center" style={{ color: r.color }}>
              {r.icon}
            </span>
            <span className="text-[11px] text-ink-2">{r.label}</span>
            <span
              className="metric-value ml-auto text-sm font-semibold tabular-nums"
              style={{ color: r.color, textShadow: `0 0 14px ${r.color}44` }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-edge bg-surface-3/30 p-3">
        <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute mb-2">
          Color gating
        </div>
        <ul className="text-[11px] text-ink-3 leading-relaxed space-y-1">
          <li>
            <span className="text-success">●</span> On-time / quality ≥ {PCT_HEALTHY}% ·
            lead ≤ {LEAD_HEALTHY} d
          </li>
          <li>
            <span className="text-warn">●</span> ≥ {PCT_WARN}% · lead ≤ {LEAD_WARN} d
          </li>
          <li>
            <span className="text-critical">●</span> below target · long lead time
          </li>
        </ul>
      </div>
    </div>
  )
}

export function SupplierScorecardsModule({ scmData }: ScmModuleProps) {
  const scorecards = scmData.scorecards
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const selected =
    selectedEntity?.type === 'supplierScorecard'
      ? scorecards.find(s => s.bpNo === selectedEntity.id) ?? null
      : null

  const atRiskCount = useMemo(() => scorecards.filter(isAtRisk).length, [scorecards])

  return (
    <div className="h-full p-4">
      <Panel className="h-full flex flex-col">
        <PanelHeader
          title="Supplier Scorecards"
          subtitle="On-time · quality · lead time — supply-network collaboration"
          icon={<BadgeCheck size={15} strokeWidth={1.9} />}
          right={
            <span className="flex items-center gap-3 text-[10px] font-mono">
              {atRiskCount > 0 && (
                <span className="inline-flex items-center gap-1 text-critical">
                  <AlertTriangle size={12} strokeWidth={2.2} className="animate-pulse-soft" />
                  {atRiskCount} at risk
                </span>
              )}
              <span className="metric-value text-sm text-ink-1">{scorecards.length}</span>
            </span>
          }
        />

        {scorecards.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-success/10 border border-success/25 flex items-center justify-center mb-3">
              <ShieldCheck size={22} strokeWidth={1.8} className="text-success" />
            </div>
            <div className="text-sm font-semibold text-ink-2">No ASNs in window</div>
            <div className="text-xs text-ink-3 mt-1 max-w-xs">
              Supplier scorecards appear once vendor advance ship notices arrive on the network.
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {scorecards.map(card => (
                <ScorecardCard
                  key={card.bpNo}
                  card={card}
                  selected={selectedEntity?.id === card.bpNo}
                  onSelect={() =>
                    selectEntity({ type: 'supplierScorecard', id: card.bpNo })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </Panel>

      {selected && (
        <DrillInPanel title={selected.name} subtitle={`${selected.bpNo} · supplier scorecard`}>
          <ScorecardDetail card={selected} />
        </DrillInPanel>
      )}
    </div>
  )
}
