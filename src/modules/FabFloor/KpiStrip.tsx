import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Observable } from 'rxjs'
import type { KpiTickEvent } from '../../lib/events'
import { MetricTile } from '../../components/ui/MetricTile'
import { Gauge } from '../../components/ui/Gauge'
import { chartSeries } from '../../lib/tokens'
import { Gauge as GaugeIcon, Activity, Boxes, Clock, Layers } from 'lucide-react'

interface KpiStripProps {
  kpiTick$: Observable<KpiTickEvent>
}

interface TileConfig {
  label: string
  format: (kpi: KpiTickEvent) => string
  unit: string
  colorIndex: number
  icon: ReactNode
  /** When set, render a radial Gauge instead of a flat metric tile. */
  gauge?: { value: (kpi: KpiTickEvent) => number; max: number }
}

const TILES: TileConfig[] = [
  {
    label: 'OEE',
    format: k => (k.oee * 100).toFixed(1),
    unit: '%',
    colorIndex: 0,
    icon: <GaugeIcon size={14} strokeWidth={1.9} />,
    gauge: { value: k => k.oee * 100, max: 100 },
  },
  {
    label: 'Yield',
    format: k => (k.yieldPct * 100).toFixed(1),
    unit: '%',
    colorIndex: 3,
    icon: <Activity size={14} strokeWidth={1.9} />,
    gauge: { value: k => k.yieldPct * 100, max: 100 },
  },
  {
    label: 'Throughput',
    format: k => Math.round(k.throughputUnitsPerHour).toString(),
    unit: 'wph',
    colorIndex: 1,
    icon: <Boxes size={14} strokeWidth={1.9} />,
  },
  {
    label: 'MTBF',
    format: k => Math.round(k.mtbfMinutes / 60).toString(),
    unit: 'h',
    colorIndex: 2,
    icon: <Clock size={14} strokeWidth={1.9} />,
  },
  {
    label: 'WIP',
    format: k => Math.round(k.wipTurn * 575).toString(),
    unit: 'lots',
    colorIndex: 4,
    icon: <Layers size={14} strokeWidth={1.9} />,
  },
]

/** Compact radial-gauge KPI card, used for ratio metrics (OEE / Yield). */
function GaugeCard({
  tile,
  kpi,
}: {
  tile: TileConfig
  kpi: KpiTickEvent | null
}) {
  const color = chartSeries[tile.colorIndex % chartSeries.length]
  const gaugeValue = kpi && tile.gauge ? tile.gauge.value(kpi) : 0
  const valueText = kpi ? tile.format(kpi) : '—'

  return (
    <div className="panel panel-hover p-3.5 relative overflow-hidden flex items-center gap-3.5">
      <Gauge
        value={gaugeValue}
        max={tile.gauge?.max ?? 100}
        size={76}
        stroke={8}
        color={color}
        valueText={
          <span className="text-base">
            {valueText}
            <span className="text-[10px] text-ink-3 ml-0.5">{tile.unit}</span>
          </span>
        }
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center" style={{ color }} aria-hidden>
            {tile.icon}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3 truncate">
            {tile.label}
          </span>
        </div>
        <div className="text-[10px] text-ink-mute mt-1 font-mono">
          live · {tile.unit}
        </div>
      </div>
      {/* Corner glow bloom */}
      <span
        className="pointer-events-none absolute -right-6 -top-8 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: color }}
        aria-hidden
      />
    </div>
  )
}

export function KpiStrip({ kpiTick$ }: KpiStripProps) {
  const [kpi, setKpi] = useState<KpiTickEvent | null>(null)

  useEffect(() => {
    const sub = kpiTick$.subscribe(setKpi)
    return () => sub.unsubscribe()
  }, [kpiTick$])

  return (
    <div className="flex gap-3 shrink-0">
      {TILES.map(tile =>
        tile.gauge ? (
          <div key={tile.label} className="flex-1 min-w-0">
            <GaugeCard tile={tile} kpi={kpi} />
          </div>
        ) : (
          <MetricTile
            key={tile.label}
            label={tile.label}
            value={kpi ? tile.format(kpi) : '—'}
            unit={tile.unit}
            colorIndex={tile.colorIndex}
            icon={tile.icon}
            className="flex-1 min-w-0"
          />
        ),
      )}
    </div>
  )
}
