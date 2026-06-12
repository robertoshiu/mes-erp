import type { ReactNode } from 'react'

export interface DonutSegment {
  value: number
  color: string
  label: string
}

interface DonutSparkProps {
  segments: DonutSegment[]
  /** Pixel diameter. */
  size?: number
  /** Small caption under the center value. */
  centerLabel?: ReactNode
  /** Big center read-out (defaults to the segment total). */
  centerValue?: ReactNode
}

/** Small pure-SVG donut with glow. Legend-less — each arc carries a title-attr
 *  tooltip (label + value). No recharts, cheap for header clusters / cells. */
export function DonutSpark({ segments, size = 72, centerLabel, centerValue }: DonutSparkProps) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0)
  const stroke = Math.max(6, Math.round(size * 0.14))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  let offset = 0
  const arcs = segments.map((seg, i) => {
    const frac = total > 0 ? Math.max(0, seg.value) / total : 0
    const len = frac * c
    const arc = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${c - len}`}
        strokeDashoffset={-offset}
        style={{ filter: `drop-shadow(0 0 2px ${seg.color})` }}
      >
        <title>{`${seg.label}: ${seg.value}`}</title>
      </circle>
    )
    offset += len
    return arc
  })

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {arcs}
      </svg>
      {(centerValue !== undefined || centerLabel !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="metric-value text-[13px] font-semibold text-ink-1 leading-none">
            {centerValue ?? total}
          </span>
          {centerLabel !== undefined && (
            <span className="text-[8px] uppercase tracking-[0.16em] text-ink-3 mt-0.5">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
