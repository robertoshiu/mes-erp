import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  width: number
  render: (row: T) => React.ReactNode
  sortFn?: (a: T, b: T) => number
  mono?: boolean
  /**
   * Let this one column absorb horizontal slack (flex-grows past `width`, which
   * becomes its min-width). At most one column per table should set this. Used so
   * a wide screen fills the row while a narrow one (e.g. when the drill-in panel
   * is open) compresses this column first and the table scrolls cleanly.
   */
  flex?: boolean
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
  /** Message shown when there are no rows. */
  emptyMessage?: string
}

export function DenseDataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  rowClassName,
  rowHeight = 34,
  emptyMessage = 'No data available',
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

  // Min content width = sum of every column's base width. Drives the shared
  // horizontal scroll track so header + body scroll as one and never desync.
  const minTrackWidth = useMemo(
    () => columns.reduce((sum, c) => sum + c.width, 0),
    [columns],
  )

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

  // Bring a programmatic selection into view (cross-domain handoff can target an
  // off-screen row that the virtualizer hasn't rendered yet).
  useEffect(() => {
    if (selectedKey == null) return
    const idx = sortedData.findIndex(r => rowKey(r) === selectedKey)
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'center' })
  }, [selectedKey, sortedData, rowKey, virtualizer])

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      {/* Single horizontal scroll context: header + body share one overflow-x
          track (min-width = Σ column widths) so they never desync on h-scroll. */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex h-full min-h-0 flex-col" style={{ minWidth: minTrackWidth }}>
          {/* Header (sticky within the shared track) */}
          <div className="sticky top-0 z-10 flex shrink-0 bg-surface-3/60 border-b border-edge text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            {columns.map(col => {
              const sorted = sortCol === col.key
              return (
                <div
                  key={col.key}
                  className={cn(
                    'px-2.5 py-2.5 flex items-center gap-1 select-none transition-colors',
                    col.flex ? 'flex-1 min-w-0' : 'shrink-0',
                    col.sortFn && 'cursor-pointer hover:text-accent hover:bg-surface-3',
                    sorted && 'text-accent',
                  )}
                  style={col.flex ? { minWidth: col.width } : { width: col.width }}
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

          {/* Virtualized rows (vertical scroll only — h-scroll lives on the
              shared parent so the header tracks the body). */}
          <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto relative">
            {sortedData.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-mute pointer-events-none">
                <Inbox size={28} strokeWidth={1.5} className="text-ink-3" />
                <span className="text-xs font-medium tracking-wide">{emptyMessage}</span>
              </div>
            )}
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
                          'px-2.5 truncate',
                          col.flex ? 'flex-1 min-w-0' : 'shrink-0',
                          col.mono ? 'font-mono text-ink-2' : 'text-ink-1',
                          isSelected && 'text-ink-1',
                        )}
                        style={col.flex ? { minWidth: col.width } : { width: col.width }}
                      >
                        {col.render(row)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
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
