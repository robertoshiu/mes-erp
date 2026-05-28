import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { EventBus } from '../../lib/eventBus'
import type { KpiTickEvent } from '../../lib/events'
import { computeKpis } from '../../lib/kpi'

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

  return (
    <div className="p-4 grid grid-cols-4 gap-3 h-full auto-rows-min">
      {TILES.map(tile => {
        const value = currentKpi ? (currentKpi as Record<string, number>)[tile.key] : 0
        const sparkData = history.map(h => ({ v: (h as Record<string, number>)[tile.key] }))

        return (
          <div key={tile.key} className="border border-[#D1D5DB] bg-white p-4">
            <div className="text-xs text-[#6B7280] mb-1">{tile.label}</div>
            <div className="text-2xl font-semibold text-[#1A1A1A] font-mono">
              {currentKpi ? tile.format(value) : '\u2014'}
              <span className="text-xs font-normal text-[#6B7280] ml-1">{tile.unit}</span>
            </div>
            <div className="h-12 mt-2">
              {sparkData.length > 2 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke="#0066B3" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
