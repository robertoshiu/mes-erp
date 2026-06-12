import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useUiStore, type SelectedEntity } from '../lib/uiStore'
import { Panel, PanelHeader } from './ui/Panel'
import { DenseDataTable, type Column } from './DenseDataTable'
import { DrillInPanel } from './DrillInPanel'

export interface MasterDataModuleProps<T> {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  entityType: SelectedEntity['type']
  headerRight?: React.ReactNode
  renderDetail: (row: T) => React.ReactNode
  detailTitle: (row: T) => string
  detailSubtitle?: (row: T) => string
  /** Row fields the header text filter matches against. Omit to hide the filter. */
  filterKeys?: (keyof T)[]
  /** Placeholder for the filter input (only shown when `filterKeys` is set). */
  filterPlaceholder?: string
  /** Optional `data-tour` value placed on the table Panel (guided-tour target). */
  dataTour?: string
}

/**
 * Generic, config-driven shell for the ERP "dense table + drill-in" screens.
 * Holds zero ERP-specific knowledge: callers supply the data, columns, and
 * detail renderers. Selection is owned by the shared uiStore so the drill-in
 * panel and table highlight stay in sync.
 */
export function MasterDataModule<T>({
  title,
  subtitle,
  icon,
  data,
  columns,
  rowKey,
  entityType,
  headerRight,
  renderDetail,
  detailTitle,
  detailSubtitle,
  filterKeys,
  filterPlaceholder,
  dataTour,
}: MasterDataModuleProps<T>): React.JSX.Element {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const [query, setQuery] = useState('')

  const filterable = !!filterKeys && filterKeys.length > 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!filterKeys || filterKeys.length === 0 || q === '') return data
    return data.filter(row =>
      filterKeys.some(key => String(row[key]).toLowerCase().includes(q)),
    )
  }, [data, filterKeys, query])

  const selectedRow =
    selectedEntity?.type === entityType
      ? data.find(row => rowKey(row) === selectedEntity.id) ?? null
      : null

  const queryActive = query.trim() !== ''
  const noMatches = filterable && queryActive && filtered.length === 0

  const filterControl = filterable ? (
    <div className="relative flex items-center w-56 max-w-[14rem]">
      <Search size={13} strokeWidth={1.9} className="absolute left-2.5 text-ink-3 pointer-events-none" />
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={filterPlaceholder ?? 'Filter...'}
        className="w-full bg-surface-2 border border-edge rounded-md pl-7 pr-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent transition-colors"
      />
    </div>
  ) : null

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden" data-tour={dataTour}>
          <PanelHeader
            title={title}
            subtitle={subtitle}
            icon={icon}
            right={
              filterControl || headerRight ? (
                <>
                  {filterControl}
                  {headerRight}
                </>
              ) : undefined
            }
          />
          <div className="flex-1 min-h-0">
            {noMatches ? (
              <div className="flex flex-col items-center justify-center gap-2 h-full px-4 py-10 text-center">
                <Search size={20} strokeWidth={1.6} className="text-ink-3" />
                <div className="text-xs text-ink-2">No records match "{query.trim()}"</div>
                <div className="text-[11px] text-ink-3">Try a different search term.</div>
              </div>
            ) : (
              <DenseDataTable
                data={filtered}
                columns={columns}
                rowKey={rowKey}
                onRowClick={row => selectEntity({ type: entityType, id: rowKey(row) })}
                selectedKey={selectedEntity?.id ?? null}
              />
            )}
          </div>
        </Panel>
      </div>

      {selectedRow && (
        <DrillInPanel title={detailTitle(selectedRow)} subtitle={detailSubtitle?.(selectedRow)}>
          {renderDetail(selectedRow)}
        </DrillInPanel>
      )}
    </div>
  )
}
