import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import type { MesEvent } from '../lib/events'
import { format } from 'date-fns'

interface EventStreamProps {
  events$: Observable<MesEvent>
  maxVisible?: number
}

interface DisplayEvent {
  event: MesEvent
  id: number
  pinned: boolean
  pinnedUntil: number
}

let eventCounter = 0

function severityOf(event: MesEvent): 'critical' | 'major' | 'minor' | 'routine' {
  if (event.topic === 'alarm.raised') {
    return event.severity === 'critical' ? 'critical' : event.severity === 'major' ? 'major' : 'minor'
  }
  if (event.topic === 'spc.violation' && event.severity === 'critical') return 'critical'
  if (event.topic === 'spc.violation') return 'major'
  return 'routine'
}

function eventMessage(event: MesEvent): string {
  switch (event.topic) {
    case 'lot.move': return `${event.lotId} moved to ${event.toToolId} (step ${event.routeStep})`
    case 'equip.state': return `${event.toolId}: ${event.fromState} -> ${event.toState}`
    case 'spc.violation': return `Rule ${event.ruleNumber} violation: ${event.controlPoint.value.toFixed(2)} (UCL=${event.controlPoint.ucl.toFixed(2)})`
    case 'alarm.raised': return `[${event.severity.toUpperCase()}] ${event.message}`
    case 'recipe.load': return `${event.toolId} loaded ${event.recipeId} ${event.recipeVersion}`
    case 'kpi.tick': return `OEE=${(event.oee * 100).toFixed(1)}% Yield=${(event.yieldPct * 100).toFixed(1)}%`
    case 'shift.boundary': return `Shift ${event.kind}: ${event.shiftCode}`
  }
}

const SEVERITY_STYLES = {
  critical: 'border-l-[3px] border-l-[#DC2626] font-semibold bg-[#FEF2F2]',
  major: 'border-l-[3px] border-l-[#B45309] font-medium bg-[#FFFBEB]',
  minor: 'border-l border-l-[#F59E0B]',
  routine: 'border-l border-l-[#D1D5DB]',
}

export function EventStream({ events$, maxVisible = 50 }: EventStreamProps) {
  const [items, setItems] = useState<DisplayEvent[]>([])
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sub = events$.subscribe(event => {
      const severity = severityOf(event)
      const shouldPin = severity === 'critical' || severity === 'major'
      const entry: DisplayEvent = {
        event,
        id: ++eventCounter,
        pinned: shouldPin,
        pinnedUntil: shouldPin ? Date.now() + 10_000 : 0,
      }

      setItems(prev => {
        const unpinned = prev.map(item => ({
          ...item,
          pinned: item.pinned && Date.now() < item.pinnedUntil,
        }))
        const next = [entry, ...unpinned].slice(0, maxVisible)
        // Sort: pinned first, then by time descending
        next.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.id - a.id
        })
        return next
      })
    })
    return () => sub.unsubscribe()
  }, [events$, maxVisible])

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [items, paused])

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto text-xs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map(item => {
        const severity = severityOf(item.event)
        return (
          <div
            key={item.id}
            className={`px-2 py-1.5 ${SEVERITY_STYLES[severity]} ${item.pinned ? 'bg-opacity-100' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#6B7280] shrink-0">
                {item.event.t.toFixed(1)}s
              </span>
              <span className="font-mono text-[#6B7280] shrink-0">
                {item.event.topic}
              </span>
            </div>
            <div className="mt-0.5 text-[#303030]">{eventMessage(item.event)}</div>
          </div>
        )
      })}
    </div>
  )
}
