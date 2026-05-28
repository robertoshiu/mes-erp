import { useState, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

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
  rowHeight?: number
}

export function DenseDataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  rowHeight = 32,
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
    overscan: 10,
  })

  const handleSort = useCallback((key: string) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }, [sortCol])

  return (
    <div className="flex flex-col h-full border border-[#D1D5DB] rounded-none">
      {/* Header */}
      <div className="flex bg-[#F3F6F9] border-b border-[#D1D5DB] text-xs font-semibold text-[#6B7280]">
        {columns.map(col => (
          <div
            key={col.key}
            className="px-2 py-2 cursor-pointer hover:bg-[#E5E7EB] select-none shrink-0"
            style={{ width: col.width }}
            onClick={() => col.sortFn && handleSort(col.key)}
          >
            {col.header}
            {sortCol === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vRow => {
            const row = sortedData[vRow.index]
            return (
              <div
                key={rowKey(row)}
                className="absolute left-0 right-0 flex items-center text-xs border-b border-[#E5E7EB] hover:bg-[#F3F6F9] cursor-pointer"
                style={{ height: rowHeight, transform: `translateY(${vRow.start}px)` }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <div
                    key={col.key}
                    className={`px-2 truncate shrink-0 ${col.mono ? 'font-mono' : ''}`}
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
      <div className="px-2 py-1 text-xs text-[#6B7280] border-t border-[#D1D5DB] bg-[#F3F6F9]">
        {sortedData.length} rows
      </div>
    </div>
  )
}
