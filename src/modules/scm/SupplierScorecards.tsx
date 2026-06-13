import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { BadgeCheck, Clock, ShieldCheck, Timer, TruckIcon, AlertTriangle, Trophy } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { Gauge } from '../../components/ui/Gauge'
import { DrillInPanel } from '../../components/DrillInPanel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { ChartDefs } from '../../lib/chartTheme'
import { useUiStore } from '../../lib/uiStore'
import { mulberry32 } from '../../data/prng'
import { sem } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import { compositeScore, radarAxes, podium } from './scorecardViz'
import type { AppEvent } from '../../lib/events'
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

/** Stable per-vendor salt so each scorecard drifts on its own phase. */
function bpSalt(bpNo: string): number {
  let h = 0
  for (let i = 0; i < bpNo.length; i++) h = (h * 31 + bpNo.charCodeAt(i)) >>> 0
  return h % 997
}

const clampPct = (v: number) => Math.max(55, Math.min(99.9, v))

/** Fold live supplier ASNs (scm.supplier.asn) from the ring buffer onto the seeded
 *  scorecards. Each notice bumps that vendor's Open-ASN count AND nudges its
 *  on-time / quality / lead gauges along a bounded deterministic oscillation, so the
 *  whole card visibly updates as notices arrive — not just a corner counter. The
 *  ring buffer is bounded (~last 1000 events) so counts self-heal across loop wraps. */
function foldAsns(base: SupplierScorecard[], buffer: AppEvent[]): SupplierScorecard[] {
  const asnByBp = new Map<string, number>()
  for (const e of buffer) {
    if (e.topic === 'scm.supplier.asn') asnByBp.set(e.bpNo, (asnByBp.get(e.bpNo) ?? 0) + 1)
  }
  if (asnByBp.size === 0) return base
  // Global ASN tick so EVERY card drifts a little on every notice (not only the
  // one vendor that received it) — the panel reads as continuously live.
  let total = 0
  for (const v of asnByBp.values()) total += v
  return base.map(c => {
    const n = asnByBp.get(c.bpNo) ?? 0
    if (n === 0 && total === 0) return c
    const salt = bpSalt(c.bpNo)
    // phase advances on every ASN (total increments) and carries a per-vendor
    // offset, so all gauges move continuously yet each on its own curve.
    const wave = (k: number) => Math.sin(total * 0.22 + n * 0.4 + salt * 0.013 + k)
    return {
      ...c,
      openAsns: c.openAsns + n,
      onTimePct: clampPct(c.onTimePct + wave(0) * 3),
      qualityPct: clampPct(c.qualityPct + wave(1.7) * 2),
      avgLeadDays: Math.max(2, c.avgLeadDays + wave(3.1) * 2.5),
    }
  })
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
      <ResponsiveContainer width="100%" height={32}>
        <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <ChartDefs />
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
            filter="url(#fpGlow)"
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
  const composite = compositeScore(card)
  const compositeColor = capColor(composite)
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

      {/* Trend sparkline + composite score + open-ASN count */}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute mb-0.5">
            On-time trend
          </div>
          <Sparkline data={spark} color={onTimeColor} />
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute">Composite</div>
          <div
            className="metric-value text-lg font-semibold leading-none tabular-nums"
            style={{ color: compositeColor, textShadow: `0 0 12px ${compositeColor}55` }}
          >
            <AnimatedNumber value={composite} format={n => n.toFixed(1)} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute">Open ASNs</div>
          <div className="metric-value text-lg font-semibold leading-none text-ink-1 tabular-nums">
            <AnimatedNumber value={card.openAsns} />
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

  const composite = compositeScore(card)
  const compositeColor = capColor(composite)
  const axes = radarAxes(card)

  return (
    <div className="flex flex-col gap-4">
      {atRisk && (
        <div className="row-hot flex items-center gap-2 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
          <AlertTriangle size={14} strokeWidth={2} />
          At-risk supplier — one or more metrics below target. Expedite open ASNs.
        </div>
      )}

      {/* Composite score + normalized performance radar (on-time / quality / lead). */}
      <div className="rounded-md border border-edge bg-surface-3/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.16em] text-ink-mute">Composite Score</span>
          <span
            className="metric-value text-2xl font-semibold leading-none tabular-nums"
            style={{ color: compositeColor, textShadow: `0 0 16px ${compositeColor}55` }}
          >
            <AnimatedNumber value={composite} format={n => n.toFixed(1)} />
          </span>
        </div>
        <div className="h-44 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={axes} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
              <ChartDefs />
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#AEBBD0' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke={ACCENT_3}
                fill={ACCENT_3}
                fillOpacity={0.32}
                strokeWidth={2}
                filter="url(#fpGlow)"
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

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

/** Tier podium band — top-3 suppliers on glowing pedestals, heights scaled by
 *  composite score. Center pedestal = rank 1 (tallest), flanked by 2 and 3.
 *  Each pedestal selects its supplier (opens the drill-in). */
function PodiumBand({
  entries,
  onSelect,
}: {
  entries: ReturnType<typeof podium>
  onSelect: (bpNo: string) => void
}) {
  // Display order: 2nd · 1st · 3rd (classic podium). Missing slots are dropped.
  const order = [entries[1], entries[0], entries[2]].filter(Boolean)
  const PED_COLORS = ['#C0CAD8', '#FBBF24', '#E0A06A'] // silver / gold / bronze, by rank
  const rankOf = (bpNo: string) => entries.findIndex(e => e.bpNo === bpNo)
  const MIN_H = 28
  const MAX_H = 84

  return (
    <Panel className="shrink-0 animate-rise overflow-hidden" data-tour="supplier-scorecards.podium" style={{ animationDelay: '60ms' }}>
      <div className="flex items-center gap-1.5 px-3.5 pt-2.5">
        <Trophy size={13} strokeWidth={2} className="text-warn" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">Top Suppliers · Composite</span>
      </div>
      <div className="flex items-end justify-center gap-4 px-4 pb-3 pt-2" style={{ minHeight: 130 }}>
        {order.map(entry => {
          const rank = rankOf(entry.bpNo)
          const color = PED_COLORS[rank] ?? '#74849E'
          const h = MIN_H + (Math.max(0, Math.min(100, entry.score)) / 100) * (MAX_H - MIN_H)
          return (
            <button
              key={entry.bpNo}
              type="button"
              onClick={() => onSelect(entry.bpNo)}
              className="group flex w-28 flex-col items-center gap-1.5 text-center focus-visible:outline-none"
            >
              <span className="text-[10px] font-semibold text-ink-1 truncate w-full" title={entry.name}>
                {entry.name}
              </span>
              <span
                className="metric-value text-lg font-semibold leading-none tabular-nums"
                style={{ color, textShadow: `0 0 14px ${color}66` }}
              >
                <AnimatedNumber value={entry.score} format={n => n.toFixed(1)} />
              </span>
              <div
                className="w-full rounded-t-md border-t border-x transition-all"
                style={{
                  height: h,
                  background: `linear-gradient(180deg, ${color}33, ${color}0d)`,
                  borderColor: `${color}66`,
                  boxShadow: `0 0 16px -2px ${color}55, inset 0 1px 0 ${color}55`,
                }}
              >
                <span className="flex h-full items-start justify-center pt-1.5 text-[13px] font-bold" style={{ color }}>
                  {rank + 1}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

export function SupplierScorecardsModule({ scmData, eventBus }: ScmModuleProps) {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  // Live scorecards: seed the Open-ASN counts from the ring buffer on mount, then
  // re-fold on every scm.supplier.asn so the panel reflects vendor notices as they
  // arrive instead of freezing on the static seed (mirrors ControlTower).
  const [scorecards, setScorecards] = useState<SupplierScorecard[]>(
    () => foldAsns(scmData.scorecards, eventBus.getBuffer()),
  )

  useEffect(() => {
    const apply = () => setScorecards(foldAsns(scmData.scorecards, eventBus.getBuffer()))
    apply()
    const sub = eventBus.ofTopic('scm.supplier.asn').subscribe(apply)
    return () => sub.unsubscribe()
  }, [eventBus, scmData.scorecards])

  const selected =
    selectedEntity?.type === 'supplierScorecard'
      ? scorecards.find(s => s.bpNo === selectedEntity.id) ?? null
      : null

  const atRiskCount = useMemo(() => scorecards.filter(isAtRisk).length, [scorecards])
  const healthyCount = scorecards.length - atRiskCount
  const top3 = useMemo(() => podium(scorecards, 3), [scorecards])

  return (
    <div className="relative h-full p-4 flex flex-col gap-3">
      <div className="bg-bloom" aria-hidden />

      {/* Cinematic module identity — fleet health folds into live pills. */}
      <ModuleHeader
        className="shrink-0 animate-rise"
        domain="SCM"
        icon={<BadgeCheck size={13} strokeWidth={2} />}
        title="Supplier Scorecards"
        subtitle="On-time · quality · lead time — supply-network collaboration"
        pills={[
          { label: 'Suppliers', value: <AnimatedNumber value={scorecards.length} />, tone: 'info' },
          { label: 'Healthy', value: <AnimatedNumber value={healthyCount} />, tone: 'success' },
          {
            label: 'At Risk',
            value: <AnimatedNumber value={atRiskCount} />,
            tone: atRiskCount > 0 ? 'critical' : 'success',
          },
        ]}
      />

      {/* Tier podium — top-3 suppliers on glowing pedestals (heights by composite). */}
      {top3.length > 0 && <PodiumBand entries={top3} onSelect={bpNo => selectEntity({ type: 'supplierScorecard', id: bpNo })} />}

      <Panel className="flex-1 min-h-0 flex flex-col animate-rise" style={{ animationDelay: '120ms' }}>
        <PanelHeader
          title="Fleet"
          subtitle={`${scorecards.length} suppliers · click a card for the full scorecard`}
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-tour="supplier-scorecards.grid">
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
        <DrillInPanel overlay title={selected.name} subtitle={`${selected.bpNo} · supplier scorecard`}>
          <ScorecardDetail card={selected} />
        </DrillInPanel>
      )}
    </div>
  )
}
