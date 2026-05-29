import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, LineChart, Radio, Target, Layers, Gauge as GaugeIcon } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { DenseDataTable } from '../../components/DenseDataTable'
import type { Column } from '../../components/DenseDataTable'
import { MetricTile } from '../../components/ui/MetricTile'
import { CHART, ChartDefs, ChartTooltip } from '../../lib/chartTheme'
import { chartSeries } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import type { ScmModuleProps } from './types'

const FORECAST_COLOR = chartSeries[2] // indigo — the SCM domain accent
const ACTUAL_COLOR = chartSeries[3]   // emerald

/** Bucket labels: IBP weekly horizon. */
function bucketLabel(i: number): string {
  return `W${i + 1}`
}

/** Integer-aware label for the ChartTooltip header (the X bucket). */
function bucketTooltipLabel(label: string | number): string {
  const i = typeof label === 'number' ? label : parseInt(label, 10)
  return Number.isFinite(i) ? `Week ${i + 1}` : String(label)
}

/**
 * Diverging variance color, mirroring SPC capColor(): emerald when actuals run
 * UNDER forecast (slack), amber near plan, rose when actuals run OVER (demand
 * blowing past the plan). `v` is the signed variance fraction (actual−fcst)/fcst.
 */
function varianceColor(v: number): string {
  const a = Math.abs(v)
  if (a < 0.06) return '#FBBF24'   // amber — on plan
  return v > 0 ? '#FB7185' : '#34D399' // rose over / emerald under
}

/** A material's plan, with any live forecast overlays folded in. */
interface PlanRow {
  materialNo: string
  buckets: number[]
  actuals: number[]
}

/** One displayed grid row: a labeled metric band for a material. */
type RowKind = 'forecast' | 'actual' | 'variance'
interface GridRow {
  key: string
  materialNo: string
  kind: RowKind
  /** First row of a material block (draws the material label + top hairline). */
  lead: boolean
  values: number[]
}

/** Build the three-band (forecast / actual / variance) grid rows. */
function buildGridRows(plans: PlanRow[]): GridRow[] {
  const rows: GridRow[] = []
  for (const p of plans) {
    const variance = p.buckets.map((f, i) => (f > 0 ? (p.actuals[i] - f) / f : 0))
    rows.push({ key: `${p.materialNo}:f`, materialNo: p.materialNo, kind: 'forecast', lead: true, values: p.buckets })
    rows.push({ key: `${p.materialNo}:a`, materialNo: p.materialNo, kind: 'actual', lead: false, values: p.actuals })
    rows.push({ key: `${p.materialNo}:v`, materialNo: p.materialNo, kind: 'variance', lead: false, values: variance })
  }
  return rows
}

const KIND_LABEL: Record<RowKind, string> = {
  forecast: 'Forecast',
  actual: 'Actual',
  variance: 'Variance',
}

export function DemandPlanningModule({ scmData, eventBus }: ScmModuleProps) {
  // Live forecast overlays: scm.forecast.updated re-plans a material bucket.
  // Keyed `${materialNo}:${bucket}` → latest qty, folded onto the static plan.
  const [overlays, setOverlays] = useState<Record<string, number>>({})
  // The material whose curve drives the chart (defaults to the first FERT).
  const [selectedNo, setSelectedNo] = useState<string | null>(null)
  const [updateCount, setUpdateCount] = useState(0)

  useEffect(() => {
    const sub = eventBus.ofTopic('scm.forecast.updated').subscribe(e => {
      setOverlays(prev => ({ ...prev, [`${e.materialNo}:${e.bucket}`]: e.qty }))
      setUpdateCount(c => c + 1)
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  // Fold live overlays onto the seeded forecasts.
  const plans = useMemo<PlanRow[]>(
    () =>
      scmData.forecasts.map(f => ({
        materialNo: f.materialNo,
        buckets: f.buckets.map((q, i) => overlays[`${f.materialNo}:${i}`] ?? q),
        actuals: f.actuals,
      })),
    [scmData.forecasts, overlays],
  )

  const activeNo = selectedNo ?? plans[0]?.materialNo ?? null
  const active = useMemo(() => plans.find(p => p.materialNo === activeNo) ?? null, [plans, activeNo])

  const gridRows = useMemo(() => buildGridRows(plans), [plans])

  // KPI rail aggregates across the whole plan window (number-first).
  const kpis = useMemo(() => computeKpis(plans), [plans])

  // Chart series for the active material + the spike-beat reference bucket.
  const chartData = useMemo(() => {
    if (!active) return []
    return active.buckets.map((forecast, i) => ({ i, forecast, actual: active.actuals[i] }))
  }, [active])

  // The demand-spike beat: the bucket with the largest over-plan variance.
  const spikeBucket = useMemo(() => {
    if (!active) return -1
    let best = -1
    let bestV = 0.06
    active.buckets.forEach((f, i) => {
      if (f <= 0) return
      const v = (active.actuals[i] - f) / f
      if (v > bestV) { bestV = v; best = i }
    })
    return best
  }, [active])

  // Bucket count drives the grid columns.
  const bucketCount = scmData.forecasts[0]?.buckets.length ?? 0

  const columns = useMemo<Column<GridRow>[]>(() => {
    const cols: Column<GridRow>[] = [
      {
        key: 'material',
        header: 'Material · Metric',
        width: 220,
        render: row => (
          <div className="flex items-baseline gap-2 min-w-0">
            {row.lead ? (
              <span className="font-mono text-ink-1 shrink-0">{row.materialNo}</span>
            ) : (
              <span className="font-mono text-ink-mute shrink-0">·</span>
            )}
            <span
              className={cn(
                'text-[10px] uppercase tracking-[0.12em]',
                row.kind === 'variance' ? 'text-ink-3' : 'text-ink-2',
              )}
            >
              {KIND_LABEL[row.kind]}
            </span>
          </div>
        ),
      },
    ]
    for (let i = 0; i < bucketCount; i++) {
      cols.push({
        key: `b${i}`,
        header: bucketLabel(i),
        width: 84,
        render: row => {
          const v = row.values[i]
          if (row.kind === 'variance') {
            const color = varianceColor(v)
            const pct = (v * 100).toFixed(0)
            return (
              <span
                className="metric-value tabular-nums text-[11px] font-semibold inline-flex items-center justify-end w-full"
                style={{ color, textShadow: `0 0 10px ${color}40` }}
              >
                {v > 0 ? '+' : ''}{pct}%
              </span>
            )
          }
          return (
            <span
              className={cn(
                'metric-value tabular-nums inline-flex items-center justify-end w-full',
                row.kind === 'forecast' ? 'text-ink-2' : 'text-ink-1',
              )}
            >
              {Math.round(v).toLocaleString()}
            </span>
          )
        },
      })
    }
    return cols
  }, [bucketCount])

  if (plans.length === 0) {
    return (
      <div className="h-full p-4">
        <Panel className="h-full flex flex-col">
          <PanelHeader title="Demand Planning" icon={<TrendingUp size={14} strokeWidth={2} />} />
          <div className="flex-1 flex items-center justify-center text-sm text-ink-3">
            Forecast warming…
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      {/* KPI rail — number-first */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <MetricTile
          label="Plan Volume"
          value={kpis.planVolume.toLocaleString()}
          unit="ea"
          colorIndex={2}
          icon={<Layers size={15} strokeWidth={1.9} />}
        />
        <MetricTile
          label="Forecast Accuracy"
          value={kpis.accuracyPct.toFixed(1)}
          unit="%"
          colorIndex={3}
          icon={<Target size={15} strokeWidth={1.9} />}
        />
        <MetricTile
          label="Bias"
          value={`${kpis.bias > 0 ? '+' : ''}${kpis.biasPct.toFixed(1)}`}
          unit="%"
          colorIndex={kpis.bias > 0 ? 5 : 3}
          icon={<GaugeIcon size={15} strokeWidth={1.9} />}
        />
        <MetricTile
          label="Materials Planned"
          value={plans.length.toString()}
          unit="FERT"
          colorIndex={0}
          icon={<TrendingUp size={15} strokeWidth={1.9} />}
        />
      </div>

      {/* Forecast vs actual — dual-axis composed chart for the active material */}
      <Panel className="shrink-0 flex flex-col">
        <PanelHeader
          title={`Demand Plan · ${activeNo ?? '—'}`}
          subtitle="Forecast vs. realized actuals across the planning horizon"
          icon={<LineChart size={15} strokeWidth={1.9} />}
          right={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-3">
              <Radio size={12} strokeWidth={1.9} className="animate-pulse-soft" />
              {updateCount > 0 ? `${updateCount} re-plans` : 'Live'}
            </span>
          }
        />
        <div className="px-2 pb-3 pt-3 min-h-0">
          <ResponsiveContainer width="100%" height={236}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 4, left: 4 }}>
              <ChartDefs />
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="i" tickFormatter={i => bucketLabel(i)} stroke={CHART.axis} tick={CHART.tick} />
              <YAxis
                yAxisId="qty"
                width={44}
                domain={[(dataMin: number) => Math.max(0, Math.floor((dataMin * 0.9) / 25) * 25), (dataMax: number) => Math.ceil((dataMax * 1.08) / 25) * 25]}
                stroke={CHART.axis}
                tick={CHART.tick}
              />
              <Tooltip content={<ChartTooltip unit=" ea" labelFormatter={bucketTooltipLabel} />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#74849E' }} />
              {spikeBucket >= 0 && (
                <ReferenceLine
                  yAxisId="qty"
                  x={spikeBucket}
                  stroke={chartSeries[5]}
                  strokeDasharray="6 4"
                  label={{ value: 'SPIKE', fill: chartSeries[5], fontSize: 9, position: 'top' }}
                />
              )}
              <Area
                yAxisId="qty"
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke={FORECAST_COLOR}
                strokeWidth={2}
                fill="url(#fpArea0)"
                filter="url(#fpGlow)"
                isAnimationActive={false}
                dot={false}
              />
              <Line
                yAxisId="qty"
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={ACTUAL_COLOR}
                strokeWidth={2}
                dot={{ r: 2.5, fill: ACTUAL_COLOR, stroke: ACTUAL_COLOR }}
                activeDot={{ r: 4, fill: ACTUAL_COLOR, stroke: ACTUAL_COLOR }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* IBP demand grid — three bands per material, variance heat-tinted */}
      <Panel className="flex-1 min-h-[260px] flex flex-col p-0 overflow-hidden">
        <PanelHeader
          title="Demand Grid · Forecast / Actual / Variance"
          subtitle={`${plans.length} materials · ${bucketCount}-week horizon · click a row to chart`}
          icon={<TrendingUp size={15} strokeWidth={1.9} />}
        />
        <div className="flex-1 min-h-0">
          <DenseDataTable
            data={gridRows}
            columns={columns}
            rowKey={r => r.key}
            selectedKey={null}
            onRowClick={r => setSelectedNo(r.materialNo)}
            rowClassName={r =>
              cn(
                r.lead && 'border-t border-edge',
                r.materialNo === activeNo && 'bg-accent-3/10',
              )
            }
            rowHeight={30}
          />
        </div>
      </Panel>
    </div>
  )
}

/** Plan-wide rollups for the KPI rail. */
function computeKpis(plans: PlanRow[]): {
  planVolume: number
  accuracyPct: number
  bias: number
  biasPct: number
} {
  let fcst = 0
  let act = 0
  let absErr = 0
  for (const p of plans) {
    for (let i = 0; i < p.buckets.length; i++) {
      const f = p.buckets[i]
      const a = p.actuals[i]
      fcst += f
      act += a
      absErr += Math.abs(a - f)
    }
  }
  const planVolume = Math.round(fcst)
  // MAPE-style accuracy: 100 − mean abs % error over forecast volume.
  const accuracyPct = fcst > 0 ? Math.max(0, 100 - (absErr / fcst) * 100) : 0
  const bias = act - fcst
  const biasPct = fcst > 0 ? (bias / fcst) * 100 : 0
  return { planVolume, accuracyPct, bias, biasPct }
}
