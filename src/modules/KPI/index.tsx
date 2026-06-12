import { useEffect, useMemo, useState } from 'react'
import { Activity, Zap, Clock, Layers, Gauge as GaugeIcon, TrendingUp, TrendingDown, LineChart, Radar as RadarIcon } from 'lucide-react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
} from 'recharts'
import { Panel } from '../../components/ui/Panel'
import { Gauge } from '../../components/ui/Gauge'
import { MetricTile } from '../../components/ui/MetricTile'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import type { EventBus } from '../../lib/eventBus'
import type { KpiTickEvent } from '../../lib/events'
import { computeKpis } from '../../lib/kpi'
import { buildKpiRadar } from './radar'
import { CHART, ChartDefs, ChartTooltip } from '../../lib/chartTheme'
import { brand, e10Colors, sem, chartSeries, neutral } from '../../lib/tokens'

interface KpiDashboardProps {
  eventBus: EventBus
  totalEquipment: number
}

interface TileConfig {
  key: keyof KpiTickEvent
  label: string
  format: (v: number) => string
  unit: string
}

const TILES: TileConfig[] = [
  { key: 'oee', label: 'OEE', format: v => (v * 100).toFixed(1), unit: '%' },
  { key: 'yieldPct', label: 'Yield', format: v => (v * 100).toFixed(1), unit: '%' },
  { key: 'throughputUnitsPerHour', label: 'Throughput', format: v => Math.round(v).toString(), unit: 'wph' },
  { key: 'mtbfMinutes', label: 'MTBF', format: v => Math.round(v / 60).toString(), unit: 'h' },
  { key: 'mttrMinutes', label: 'MTTR', format: v => Math.round(v).toString(), unit: 'min' },
  { key: 'wipTurn', label: 'WIP Turn', format: v => v.toFixed(1), unit: 'x' },
  { key: 'cycleTimeMinutes', label: 'Cycle Time', format: v => Math.round(v).toString(), unit: 'min' },
]

// Presentational config for the non-hero metric tiles: icon + palette index + trend semantics.
const TILE_PRESENTATION: Record<string, { icon: typeof Activity; colorIndex: number; upIsGood: boolean }> = {
  throughputUnitsPerHour: { icon: Activity, colorIndex: 1, upIsGood: true },
  mtbfMinutes: { icon: Zap, colorIndex: 2, upIsGood: true },
  mttrMinutes: { icon: Clock, colorIndex: 5, upIsGood: false },
  wipTurn: { icon: Layers, colorIndex: 3, upIsGood: true },
  cycleTimeMinutes: { icon: GaugeIcon, colorIndex: 4, upIsGood: false },
}

const ICON_PROPS = { size: 15, strokeWidth: 1.9 } as const

/** Compute a presentational delta from the last two history points for a metric key. */
function computeDelta(
  history: KpiTickEvent[],
  key: keyof KpiTickEvent,
  upIsGood: boolean,
): { text: string; dir: 'up' | 'down' | 'flat'; good?: boolean } | undefined {
  if (history.length < 2) return undefined
  const prev = history[history.length - 2][key] as number
  const curr = history[history.length - 1][key] as number
  const diff = curr - prev
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0

  let dir: 'up' | 'down' | 'flat' = 'flat'
  if (Math.abs(pct) >= 0.05) dir = diff > 0 ? 'up' : 'down'

  const sign = dir === 'up' ? '+' : dir === 'down' ? '−' : ''
  const text = dir === 'flat' ? '0.0%' : `${sign}${Math.abs(pct).toFixed(1)}%`
  const good = dir === 'flat' ? undefined : dir === 'up' ? upIsGood : !upIsGood

  return { text, dir, good }
}

/** A hero gauge in its own panel: small title, big radial gauge, and a trend delta.
 *  The gauge center value count-ups via AnimatedNumber (snaps under reduced-motion)
 *  once telemetry arrives; renders the priming placeholder until then. */
function HeroGaugeCard({
  title,
  ready,
  displayValue,
  unit,
  value,
  color,
  delta,
}: {
  title: string
  /** False until the first KPI snapshot lands (shows the priming placeholder). */
  ready: boolean
  /** Headline number to count up to (e.g. OEE percent). */
  displayValue: number
  unit: string
  value: number
  color: string
  delta: ReturnType<typeof computeDelta>
}) {
  const deltaColor = delta?.good === true ? sem.success : delta?.good === false ? sem.critical : '#74849E'
  const DeltaIcon = delta?.dir === 'down' ? TrendingDown : TrendingUp
  const valueText = ready ? (
    <span className="inline-flex items-baseline">
      <AnimatedNumber value={displayValue} format={n => n.toFixed(1)} />
      <span>{unit}</span>
    </span>
  ) : (
    'Priming…'
  )
  return (
    <Panel hover className="relative overflow-hidden p-4 flex flex-col">
      <div className="flex items-center gap-2.5">
        <span className="accent-tick self-stretch min-h-[18px]" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">{title}</span>
        {delta && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono"
            style={{ color: deltaColor }}
          >
            <DeltaIcon
              size={12}
              strokeWidth={2.5}
              style={{ opacity: delta.dir === 'flat' ? 0.6 : 1 }}
            />
            {delta.text}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center py-3">
        <Gauge value={value} max={100} size={148} stroke={12} color={color} valueText={valueText} label={title} />
      </div>

      {/* Corner glow bloom keyed to the gauge color */}
      <span
        className="pointer-events-none absolute -right-8 -bottom-10 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ background: color }}
        aria-hidden
      />
    </Panel>
  )
}

export function KpiDashboard({ eventBus, totalEquipment }: KpiDashboardProps) {
  // Seed from the ring buffer on mount so the gauges/tiles paint a real value on
  // first frame instead of "Priming…" (ringBuffer$ is live-only, no replay).
  const [history, setHistory] = useState<KpiTickEvent[]>(() => {
    const buffer = eventBus.getBuffer()
    if (buffer.length === 0) return []
    return [{ topic: 'kpi.tick', t: buffer[buffer.length - 1].t, ...computeKpis(buffer, totalEquipment) }]
  })
  const [currentKpi, setCurrentKpi] = useState<ReturnType<typeof computeKpis> | null>(() => {
    const buffer = eventBus.getBuffer()
    return buffer.length > 0 ? computeKpis(buffer, totalEquipment) : null
  })

  useEffect(() => {
    const sub = eventBus.ringBuffer$().subscribe(buffer => {
      const kpi = computeKpis(buffer, totalEquipment)
      setCurrentKpi(kpi)

      const tick: KpiTickEvent = {
        topic: 'kpi.tick',
        t: buffer.length > 0 ? buffer[buffer.length - 1].t : 0,
        ...kpi,
      }
      setHistory(prev => [...prev.slice(-60), tick])
    })
    return () => sub.unsubscribe()
  }, [eventBus, totalEquipment])

  const oeeTile = TILES[0]
  const yieldTile = TILES[1]
  const metricTiles = TILES.slice(2)

  const oeeValue = currentKpi ? (currentKpi as any)[oeeTile.key] : 0
  const yieldValue = currentKpi ? (currentKpi as any)[yieldTile.key] : 0

  // Normalized 0–100 KPI radar from the current snapshot (5 up-is-good axes).
  const radarData = useMemo(() => buildKpiRadar(currentKpi ? history[history.length - 1] : null), [currentKpi, history])

  // Current-vs-prior window comparison: split the history buffer in half and
  // average each KPI so the bar pair contrasts the recent window with the one
  // before it. Only meaningful once we hold a couple of windows of history.
  const windowCompare = useMemo(() => {
    if (history.length < 6) return null
    const mid = Math.floor(history.length / 2)
    const prior = history.slice(0, mid)
    const recent = history.slice(mid)
    const avg = (rows: KpiTickEvent[], key: keyof KpiTickEvent) =>
      rows.reduce((acc, r) => acc + (r[key] as number), 0) / rows.length
    return [
      { metric: 'OEE %', prev: avg(prior, 'oee') * 100, curr: avg(recent, 'oee') * 100 },
      { metric: 'Yield %', prev: avg(prior, 'yieldPct') * 100, curr: avg(recent, 'yieldPct') * 100 },
      { metric: 'Throughput', prev: avg(prior, 'throughputUnitsPerHour'), curr: avg(recent, 'throughputUnitsPerHour') },
      { metric: 'WIP Turn', prev: avg(prior, 'wipTurn'), curr: avg(recent, 'wipTurn') },
    ]
  }, [history])

  return (
    <div className="relative p-4 h-full overflow-y-auto flex flex-col gap-4">
      <div className="bg-bloom" aria-hidden />

      {/* Command strip — folds the live indicator + headline OEE/Yield into ModuleHeader. */}
      <ModuleHeader
        domain="MES"
        icon={<Activity size={13} strokeWidth={2} />}
        title="Production KPIs"
        subtitle="OEE · yield · throughput — live telemetry"
        pills={[
          {
            label: 'OEE',
            value: (
              <span className="inline-flex items-baseline">
                <AnimatedNumber value={currentKpi ? oeeValue * 100 : 0} format={n => n.toFixed(1)} />
                <span>%</span>
              </span>
            ),
            tone: 'accent',
          },
          {
            label: 'Yield',
            value: (
              <span className="inline-flex items-baseline">
                <AnimatedNumber value={currentKpi ? yieldValue * 100 : 0} format={n => n.toFixed(1)} />
                <span>%</span>
              </span>
            ),
            tone: 'success',
          },
        ]}
        right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success/70 animate-pulse-soft" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live
          </span>
        }
      />

      {/* HERO ROW: OEE + Yield gauges */}
      <div
        className="animate-rise grid grid-cols-1 sm:grid-cols-2 gap-4"
        style={{ animationDelay: '40ms' }}
        data-tour="kpi.hero"
      >
        <HeroGaugeCard
          title="OEE"
          ready={currentKpi != null}
          value={currentKpi ? oeeValue * 100 : 0}
          displayValue={currentKpi ? oeeValue * 100 : 0}
          unit="%"
          color={brand.primary}
          delta={computeDelta(history, oeeTile.key, true)}
        />
        <HeroGaugeCard
          title="Yield"
          ready={currentKpi != null}
          value={currentKpi ? yieldValue * 100 : 0}
          displayValue={currentKpi ? yieldValue * 100 : 0}
          unit="%"
          color={e10Colors.PROD}
          delta={computeDelta(history, yieldTile.key, true)}
        />
      </div>

      {/* PERFORMANCE TREND: multi-series composed chart */}
      <Panel className="animate-rise p-0 flex flex-col" style={{ animationDelay: '90ms' }}>
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <span className="accent-tick self-stretch min-h-[18px]" aria-hidden />
          <LineChart size={15} strokeWidth={1.9} className="text-accent" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-1">
            Performance Trend
          </h2>
          <span className="ml-auto text-[10px] tracking-[0.12em] text-ink-mute">last 60 ticks</span>
        </div>
        <div className="px-2 pb-3 pt-2">
          {history.length <= 2 ? (
            <div className="flex items-center justify-center h-[220px] text-[12px] text-ink-3">
              Awaiting telemetry&hellip;
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={history.map((h, i) => ({
                  i,
                  oee: h.oee * 100,
                  yieldv: h.yieldPct * 100,
                  throughput: h.throughputUnitsPerHour,
                }))}
              >
                <ChartDefs />
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" hide />
                <YAxis yAxisId="pct" domain={[(dataMin: number) => Math.max(0, Math.floor((dataMin - 6) / 5) * 5), 100]} width={34} stroke={CHART.axis} tick={CHART.tick} />
                <YAxis yAxisId="tp" orientation="right" stroke={CHART.axis} tick={CHART.tick} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: neutral.ink3 }} />
                <Area
                  yAxisId="pct"
                  dataKey="oee"
                  name="OEE %"
                  stroke={chartSeries[0]}
                  strokeWidth={2}
                  fill="url(#fpArea0)"
                  filter="url(#fpGlow)"
                  isAnimationActive={false}
                  dot={false}
                />
                <Line
                  yAxisId="pct"
                  dataKey="yieldv"
                  name="Yield %"
                  stroke={chartSeries[3]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="tp"
                  dataKey="throughput"
                  name="Throughput"
                  stroke={chartSeries[4]}
                  strokeWidth={1.75}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      {/* Radar + window-comparison row */}
      <div className="animate-rise grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ animationDelay: '130ms' }}>
        {/* Normalized KPI radar — every axis on a 0–100 goodness scale. */}
        <Panel className="p-0 flex flex-col">
          <div className="flex items-center gap-2.5 px-4 pt-4">
            <span className="accent-tick self-stretch min-h-[18px]" aria-hidden />
            <RadarIcon size={15} strokeWidth={1.9} className="text-accent" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-1">
              KPI Balance
            </h2>
            <span className="ml-auto text-[10px] tracking-[0.12em] text-ink-mute">normalized 0–100</span>
          </div>
          <div className="px-2 pb-3 pt-1">
            {!currentKpi ? (
              <div className="flex items-center justify-center h-[240px] text-[12px] text-ink-3">
                Awaiting telemetry&hellip;
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} outerRadius="72%">
                  <ChartDefs />
                  <PolarGrid stroke={CHART.grid} />
                  <PolarAngleAxis dataKey="metric" tick={{ ...CHART.tick, fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => String(l)}
                      />
                    }
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke={chartSeries[0]}
                    strokeWidth={2}
                    fill="url(#fpArea0)"
                    fillOpacity={1}
                    isAnimationActive={false}
                    filter="url(#fpGlow)"
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        {/* Current-vs-prior window comparison bars. */}
        <Panel className="p-0 flex flex-col">
          <div className="flex items-center gap-2.5 px-4 pt-4">
            <span className="accent-tick self-stretch min-h-[18px]" aria-hidden />
            <LineChart size={15} strokeWidth={1.9} className="text-accent" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-1">
              Window Comparison
            </h2>
            <span className="ml-auto inline-flex items-center gap-3 text-[10px] font-mono text-ink-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: chartSeries[2] }} aria-hidden />
                prior
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: chartSeries[0] }} aria-hidden />
                current
              </span>
            </span>
          </div>
          <div className="px-2 pb-3 pt-1">
            {!windowCompare ? (
              <div className="flex items-center justify-center h-[240px] text-[12px] text-ink-3">
                Building window history&hellip;
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={windowCompare} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                  <ChartDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="metric" stroke={CHART.axis} tick={{ ...CHART.tick, fontSize: 10 }} />
                  <YAxis stroke={CHART.axis} tick={CHART.tick} width={34} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
                  <Bar dataKey="prev" name="Prior" fill={chartSeries[2]} fillOpacity={0.55} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="curr" name="Current" fill={chartSeries[0]} fillOpacity={0.9} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Remaining metrics */}
      <div
        className="animate-rise grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        style={{ animationDelay: '170ms' }}
      >
        {metricTiles.map(tile => {
          const pres = TILE_PRESENTATION[tile.key as string]
          const value = currentKpi ? (currentKpi as any)[tile.key] : 0
          const sparkData = history.map(h => (h as any)[tile.key] as number)
          const Icon = pres.icon
          return (
            <MetricTile
              key={tile.key}
              label={tile.label}
              value={currentKpi ? tile.format(value) : '—'}
              unit={tile.unit}
              colorIndex={pres.colorIndex}
              icon={<Icon {...ICON_PROPS} />}
              data={sparkData}
              delta={computeDelta(history, tile.key, pres.upIsGood)}
            />
          )
        })}
      </div>
    </div>
  )
}
