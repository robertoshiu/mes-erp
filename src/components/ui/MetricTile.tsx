import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chartSeries } from '@/lib/tokens'

export interface MetricTileProps {
  label: string
  value: string
  unit?: string
  delta?: { text: string; dir: 'up' | 'down' | 'flat'; good?: boolean }
  /** Sparkline series (raw numbers). */
  data?: number[]
  /** Index into the vibrant series palette. */
  colorIndex?: number
  icon?: ReactNode
  className?: string
}

function deltaColor(delta: NonNullable<MetricTileProps['delta']>): string {
  if (delta.good === true) return '#34D399'
  if (delta.good === false) return '#FB7185'
  if (delta.dir === 'up') return '#34D399'
  if (delta.dir === 'down') return '#FB7185'
  return '#74849E'
}

/** KPI tile: label, glowing mono value, trend delta, and a gradient sparkline. */
export function MetricTile({
  label,
  value,
  unit,
  delta,
  data,
  colorIndex = 0,
  icon,
  className,
}: MetricTileProps) {
  const color = chartSeries[colorIndex % chartSeries.length]
  const series = (data ?? []).map((v, i) => ({ i, v }))
  const gid = `mt-${label.replace(/[^a-z0-9]/gi, '')}-${colorIndex}`
  const DeltaIcon = delta?.dir === 'down' ? TrendingDown : delta?.dir === 'flat' ? Minus : TrendingUp

  return (
    <div className={cn('panel panel-hover p-3.5 relative overflow-hidden', className)}>
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span className="flex items-center" style={{ color }}>
            {icon}
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</span>
        {delta && (
          <span
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-mono"
            style={{ color: deltaColor(delta) }}
          >
            <DeltaIcon size={12} strokeWidth={2.5} />
            {delta.text}
          </span>
        )}
      </div>

      <div className="flex items-end gap-1">
        <span
          className="metric-value text-[26px] font-semibold leading-none text-ink-1"
          style={{ textShadow: `0 0 16px ${color}55` }}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] text-ink-3 mb-0.5 font-mono">{unit}</span>}
      </div>

      <div className="h-9 mt-2 -mx-1">
        {series.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
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
        )}
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
