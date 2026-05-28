import { useEffect, useState } from 'react'
import type { Observable } from 'rxjs'
import type { KpiTickEvent } from '../../lib/events'

interface KpiStripProps {
  kpiTick$: Observable<KpiTickEvent>
}

interface TileConfig {
  label: string
  format: (kpi: KpiTickEvent) => string
  unit: string
}

const TILES: TileConfig[] = [
  { label: 'OEE', format: k => (k.oee * 100).toFixed(1), unit: '%' },
  { label: 'Yield', format: k => (k.yieldPct * 100).toFixed(1), unit: '%' },
  { label: 'Throughput', format: k => Math.round(k.throughputUnitsPerHour).toString(), unit: 'wph' },
  { label: 'MTBF', format: k => Math.round(k.mtbfMinutes / 60).toString(), unit: 'h' },
  { label: 'WIP', format: k => Math.round(k.wipTurn * 575).toString(), unit: 'lots' },
]

export function KpiStrip({ kpiTick$ }: KpiStripProps) {
  const [kpi, setKpi] = useState<KpiTickEvent | null>(null)

  useEffect(() => {
    const sub = kpiTick$.subscribe(setKpi)
    return () => sub.unsubscribe()
  }, [kpiTick$])

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-[#D1D5DB] bg-white">
      {TILES.map(tile => (
        <div key={tile.label} className="flex-1 px-3 py-2 border border-[#D1D5DB]">
          <div className="text-xs text-[#6B7280] mb-1">{tile.label}</div>
          <div className="text-xl font-semibold text-[#1A1A1A] font-mono">
            {kpi ? tile.format(kpi) : '—'}
            <span className="text-xs font-normal text-[#6B7280] ml-1">{tile.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
