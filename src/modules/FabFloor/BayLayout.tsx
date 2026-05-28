import { useEffect, useState } from 'react'
import type { Observable } from 'rxjs'
import type { EquipStateEvent, E10State } from '../../lib/events'
import { e10Colors, e10Symbols } from '../../lib/tokens'
import type { Equipment } from '../../data/master/equipment'

interface BayLayoutProps {
  equipment: Equipment[]
  equipState$: Observable<EquipStateEvent>
}

export function BayLayout({ equipment, equipState$ }: BayLayoutProps) {
  const [states, setStates] = useState<Record<string, E10State>>(() => {
    const initial: Record<string, E10State> = {}
    for (const eq of equipment) {
      initial[eq.toolId] = eq.initialState
    }
    return initial
  })

  useEffect(() => {
    const sub = equipState$.subscribe(e => {
      setStates(prev => ({ ...prev, [e.toolId]: e.toState }))
    })
    return () => sub.unsubscribe()
  }, [equipState$])

  // Layout: 2 rows of 4 bays, tools in each bay
  const svgWidth = 1000
  const svgHeight = 500
  const bayWidth = 230
  const bayHeight = 200
  const tileSize = 28
  const tileGap = 4

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
      {/* Bay backgrounds */}
      {Array.from({ length: 8 }, (_, bayIdx) => {
        const col = bayIdx % 4
        const row = Math.floor(bayIdx / 4)
        const x = col * bayWidth + 15
        const y = row * (bayHeight + 40) + 30
        return (
          <g key={`bay-${bayIdx}`}>
            <rect x={x} y={y} width={bayWidth - 10} height={bayHeight} rx={0} fill="#F3F6F9" stroke="#D1D5DB" strokeWidth={1} />
            <text x={x + 8} y={y + 18} className="text-[11px] fill-[#6B7280] font-semibold">
              BAY-{String(bayIdx + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}

      {/* Equipment tiles */}
      {equipment.map(eq => {
        const state = states[eq.toolId] || 'NSC'
        const col = eq.bayIndex % 4
        const row = Math.floor(eq.bayIndex / 4)
        const bayX = col * bayWidth + 15
        const bayY = row * (bayHeight + 40) + 30
        const tileX = bayX + 8 + eq.slotInBay * (tileSize + tileGap)
        const tileY = bayY + 30

        return (
          <g key={eq.toolId}>
            <rect
              x={tileX} y={tileY} width={tileSize} height={tileSize}
              fill={e10Colors[state]} rx={0}
              className="transition-colors duration-200"
            />
            <text
              x={tileX + tileSize / 2} y={tileY + tileSize / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              className="text-[10px] fill-white font-mono pointer-events-none"
            >
              {e10Symbols[state]}
            </text>
            <title>{eq.toolId} — {state}</title>
          </g>
        )
      })}
    </svg>
  )
}
