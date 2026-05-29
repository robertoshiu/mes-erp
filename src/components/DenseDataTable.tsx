import { useState, useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  width: number
  render: (row: T) => React.ReactNode
  sortFn?: (a: T, b: T) => number
  mono?: boolean
}

interface DenseDataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Highlight the row whose key matches (e.g. the drill-in selection). */
  selectedKey?: string | null
  /** Extra per-row classes (e.g. priority flash for hot lots). */
  rowClassName?: (row: T) => string | undefined
  rowHeight?: number
}

export function DenseDataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  rowClassName,
  rowHeight = 34,
}: DenseDataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const parentRef = useRef<HTMLDivElement>(null)

  const sortedData = useMemo(() => {
    if (!sortCol) return data
    const col = columns.find(c => c.key === sortCol)
    if (!col?.sortFn) return data
    const sorted = [...data].sort(col.sortFn)
    return sortDir === 'desc' ? sorted.reverse() : sorted
  }, [data, columns, sortCol, sortDir])

  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })

  const handleSort = useCallback((key: string) => {
    if (sortCol === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }, [sortCol])

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      {/* Header */}
      <div className="flex bg-surface-3/60 border-b border-edge text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        {columns.map(col => {
          const sorted = sortCol === col.key
          return (
            <div
              key={col.key}
              className={cn(
                'px-2.5 py-2.5 flex items-center gap-1 select-none shrink-0 transition-colors',
                col.sortFn && 'cursor-pointer hover:text-accent hover:bg-surface-3',
                sorted && 'text-accent',
              )}
              style={{ width: col.width }}
              onClick={() => col.sortFn && handleSort(col.key)}
            >
              <span className="truncate">{col.header}</span>
              {sorted && (sortDir === 'asc'
                ? <ChevronUp size={11} className="shrink-0" />
                : <ChevronDown size={11} className="shrink-0" />)}
            </div>
          )
        })}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vRow => {
            const row = sortedData[vRow.index]
            const key = rowKey(row)
            const isSelected = selectedKey != null && key === selectedKey
            return (
              <div
                key={key}
                className={cn(
                  'group absolute left-0 right-0 flex items-center text-xs border-b border-white/[0.04] cursor-pointer transition-colors',
                  vRow.index % 2 === 1 && !isSelected && 'bg-white/[0.015]',
                  isSelected ? 'bg-accent/10' : 'hover:bg-surface-3/70',
                  rowClassName?.(row),
                )}
                style={{ height: rowHeight, transform: `translateY(${vRow.start}px)` }}
                onClick={() => onRowClick?.(row)}
              >
                {/* selection / hover rail */}
                <span
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-[2px] transition-all',
                    isSelected ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/40',
                  )}
                  style={isSelected ? { boxShadow: '0 0 8px var(--accent-glow)' } : undefined}
                />
                {columns.map(col => (
                  <div
                    key={col.key}
                    className={cn(
                      'px-2.5 truncate shrink-0',
                      col.mono ? 'font-mono text-ink-2' : 'text-ink-1',
                      isSelected && 'text-ink-1',
                    )}
                    style={{ width: col.width }}
                  >
                    {col.render(row)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-1.5 text-[10px] font-mono text-ink-3 border-t border-edge bg-surface-3/40 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/70" style={{ boxShadow: '0 0 6px var(--accent-glow)' }} />
        {sortedData.length.toLocaleString()} rows
      </div>
    </div>
  )
}
