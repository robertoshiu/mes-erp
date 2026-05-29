import { useEffect, useState } from 'react'
import { Activity, Zap, Clock, Layers, Gauge as GaugeIcon, TrendingUp, LineChart } from 'lucide-react'
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
} from 'recharts'
import { Panel } from '../../components/ui/Panel'
import { Gauge } from '../../components/ui/Gauge'
import { MetricTile } from '../../components/ui/MetricTile'
import type { EventBus } from '../../lib/eventBus'
import type { KpiTickEvent } from '../../lib/events'
import { computeKpis } from '../../lib/kpi'
import { CHART, ChartDefs, ChartTooltip } from '../../lib/chartTheme'
import { brand, e10Colors, sem, chartSeries } from '../../lib/tokens'

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

/** A hero gauge in its own panel: small title, big radial gauge, and a trend delta. */
function HeroGaugeCard({
  title,
  valueText,
  value,
  color,
  delta,
}: {
  title: string
  valueText: string
  value: number
  color: string
  delta: ReturnType<typeof computeDelta>
}) {
  const deltaColor = delta?.good === true ? sem.success : delta?.good === false ? sem.critical : '#74849E'
  const DeltaIcon = TrendingUp
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
              style={{
                transform: delta.dir === 'down' ? 'scaleY(-1)' : undefined,
                opacity: delta.dir === 'flat' ? 0.6 : 1,
              }}
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
  const [history, setHistory] = useState<KpiTickEvent[]>([])
  const [currentKpi, setCurrentKpi] = useState<ReturnType<typeof computeKpis> | null>(null)

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

  return (
    <div className="p-4 h-full overflow-y-auto flex flex-col gap-4">
      {/* Page title */}
      <div className="flex items-center gap-2.5">
        <span className="accent-tick self-stretch min-h-[20px]" aria-hidden />
        <Activity size={16} strokeWidth={1.9} className="text-accent" />
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-1 text-glow-soft">
          Production KPIs
        </h1>
        <span className="text-ink-mute text-[12px]" aria-hidden>
          &middot;
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success/70 animate-pulse-soft" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      {/* HERO ROW: OEE + Yield gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HeroGaugeCard
          title="OEE"
          value={currentKpi ? oeeValue * 100 : 0}
          valueText={currentKpi ? `${oeeTile.format(oeeValue)}%` : '—'}
          color={brand.primary}
          delta={computeDelta(history, oeeTile.key, true)}
        />
        <HeroGaugeCard
          title="Yield"
          value={currentKpi ? yieldValue * 100 : 0}
          valueText={currentKpi ? `${yieldTile.format(yieldValue)}%` : '—'}
          color={e10Colors.PROD}
          delta={computeDelta(history, yieldTile.key, true)}
        />
      </div>

      {/* PERFORMANCE TREND: multi-series composed chart */}
      <Panel className="p-0 flex flex-col">
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
                <Legend wrapperStyle={{ fontSize: 10, color: '#74849E' }} />
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

      {/* Remaining metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
