import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import type { EventBus } from '../../lib/eventBus'
import type { SpcViolationEvent } from '../../lib/events'

interface SpcModuleProps {
  eventBus: EventBus
}

interface ChartPoint {
  index: number
  value: number
  isViolation: boolean
  ruleNumber?: 1 | 2 | 4
  severity?: string
}

const UCL = 55.0
const LCL = 45.0
const CENTERLINE = 50.0

export function SpcModule({ eventBus }: SpcModuleProps) {
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [violations, setViolations] = useState<SpcViolationEvent[]>([])

  useEffect(() => {
    let idx = 0
    const sub = eventBus.ofTopic('spc.violation').subscribe(e => {
      const isViolation = e.severity === 'warn' || e.severity === 'critical'
      const point: ChartPoint = {
        index: idx++,
        value: e.controlPoint.value,
        isViolation,
        ruleNumber: isViolation ? e.ruleNumber : undefined,
        severity: e.severity,
      }
      setPoints(prev => [...prev.slice(-99), point])
      if (isViolation) {
        setViolations(prev => [e, ...prev].slice(0, 20))
      }
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  return (
    <div className="flex flex-col h-full">
      {/* Control Chart */}
      <div className="flex-1 p-4">
        <div className="h-full border border-[#D1D5DB] bg-white p-4">
          <div className="text-xs font-semibold text-[#6B7280] mb-2">
            Control Chart — CD Uniformity (nm)
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={points} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis domain={[40, 60]} tick={{ fontSize: 11 }} stroke="#6B7280" />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                formatter={(value: any) => [Number(value).toFixed(2), 'Value']}
              />
              <ReferenceLine y={UCL} stroke="#DC2626" strokeDasharray="8 4" label={{ value: 'UCL', fill: '#DC2626', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={LCL} stroke="#DC2626" strokeDasharray="8 4" label={{ value: 'LCL', fill: '#DC2626', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={CENTERLINE} stroke="#0066B3" strokeDasharray="4 4" label={{ value: 'CL', fill: '#0066B3', fontSize: 10, position: 'right' }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0066B3"
                strokeWidth={1.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  if (payload.isViolation) {
                    return <circle cx={cx} cy={cy} r={5} fill="#DC2626" stroke="#DC2626" />
                  }
                  return <circle cx={cx} cy={cy} r={2.5} fill="#0066B3" stroke="#0066B3" />
                }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Violation Log */}
      <div className="h-48 border-t border-[#D1D5DB] bg-white px-4 py-2 overflow-y-auto">
        <div className="text-xs font-semibold text-[#6B7280] mb-2">Violation Log</div>
        {violations.length === 0 && (
          <div className="text-xs text-[#9CA3AF] font-mono">No violations detected</div>
        )}
        {violations.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-1 text-xs border-b border-[#E5E7EB]">
            <span className={`px-1.5 py-0.5 rounded-sm text-white text-[10px] ${v.severity === 'critical' ? 'bg-[#DC2626]' : 'bg-[#B45309]'}`}>
              {v.severity.toUpperCase()}
            </span>
            <span className="font-mono text-[#6B7280]">t={v.t.toFixed(0)}s</span>
            <span className="text-[#303030]">Rule {v.ruleNumber}: {v.controlPoint.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
