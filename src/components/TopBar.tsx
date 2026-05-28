import { useEffect, useState } from 'react'
import type { Clock } from '../lib/clock'
import { useUiStore } from '../lib/uiStore'

interface TopBarProps {
  clock: Clock
  operatorCount: number
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

export function TopBar({ clock, operatorCount }: TopBarProps) {
  const [loopT, setLoopT] = useState(0)
  const currentShift = useUiStore(s => s.currentShift)

  useEffect(() => {
    const id = setInterval(() => setLoopT(clock.loopT()), 1000)
    return () => clearInterval(id)
  }, [clock])

  const progressPct = (loopT / 180) * 100

  const shiftColor = currentShift === 'A' ? '#16A34A' : currentShift === 'B' ? '#2563EB' : '#F59E0B'

  return (
    <header className="relative h-12 flex items-center justify-between px-4 bg-white border-b border-[#D1D5DB]">
      {/* Left zone */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[#1A1A1A]">FAB-01 PROD</span>
        <span className="text-xs font-mono text-[#6B7280] border border-[#D1D5DB] px-1.5 py-0.5 rounded-sm">
          FabPulse v1.0
        </span>
      </div>

      {/* Center zone */}
      <div className="font-mono text-base text-[#1A1A1A]">
        {formatTime(loopT)}
      </div>

      {/* Right zone */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs border border-[#D1D5DB] px-1.5 py-0.5 rounded-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColor }} />
          SHIFT-{currentShift}
        </span>
        <span className="text-xs text-[#6B7280]">
          {operatorCount} on shift
        </span>
      </div>

      {/* Loop progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-[#0066B3] transition-all duration-1000 ease-linear"
        style={{ width: `${progressPct}%` }}
      />
    </header>
  )
}
