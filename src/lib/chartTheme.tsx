// Shared Recharts theming for the dark command-center look:
// vibrant series, gradient area fills, a glow filter, and a glass tooltip.
import { chartSeries } from './tokens'

export const CHART = {
  grid: 'rgba(255, 255, 255, 0.06)',
  axis: 'rgba(174, 187, 208, 0.18)',
  tick: { fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#74849E' },
  series: chartSeries,
} as const

/** Drop into any Recharts chart as a child to register gradients + glow filter.
 *  Area fills: url(#fpArea0..5). Line glow: filter="url(#fpGlow)". */
export function ChartDefs() {
  return (
    <defs>
      {chartSeries.map((c, i) => (
        <linearGradient key={i} id={`fpArea${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={0.42} />
          <stop offset="78%" stopColor={c} stopOpacity={0.04} />
          <stop offset="100%" stopColor={c} stopOpacity={0} />
        </linearGradient>
      ))}
      <filter id="fpGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string | number
  unit?: string
  labelFormatter?: (label: string | number) => string
}

/** Glass tooltip — pass as <Tooltip content={<ChartTooltip unit="%" />} />. */
export function ChartTooltip({ active, payload, label, unit, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass rounded-md px-2.5 py-1.5 text-xs min-w-28">
      {label !== undefined && (
        <div className="text-ink-3 font-mono mb-1 text-[10px]">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
          />
          {p.name && <span className="text-ink-2">{p.name}</span>}
          <span className="ml-auto font-mono text-ink-1 tabular-nums">
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
            {unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}
