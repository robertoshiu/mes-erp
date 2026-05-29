import type { ReactNode } from 'react'

interface GaugeProps {
  /** Current value. */
  value: number
  /** Scale maximum (value/max → fill fraction). */
  max?: number
  size?: number
  stroke?: number
  color?: string
  /** Big center text; defaults to rounded percentage. */
  valueText?: ReactNode
  label?: string
}

/** Radial ring gauge with a glowing progress arc. Great for OEE / Yield / utilization. */
export function Gauge({
  value,
  max = 100,
  size = 124,
  stroke = 10,
  color = '#22D3EE',
  valueText,
  label,
}: GaugeProps) {
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
            transition: 'stroke-dasharray 600ms cubic-bezier(0,0,0.2,1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="metric-value text-xl font-semibold text-ink-1" style={{ textShadow: `0 0 16px ${color}66` }}>
          {valueText ?? `${Math.round(pct * 100)}%`}
        </span>
        {label && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-ink-3 mt-0.5">{label}</span>
        )}
      </div>
    </div>
  )
}
