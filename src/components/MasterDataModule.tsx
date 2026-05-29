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
}: MasterDataModuleProps<T>): React.JSX.Element {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const selectedRow =
    selectedEntity?.type === entityType
      ? data.find(row => rowKey(row) === selectedEntity.id) ?? null
      : null

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader title={title} subtitle={subtitle} icon={icon} right={headerRight} />
          <div className="flex-1 min-h-0">
            <DenseDataTable
              data={data}
              columns={columns}
              rowKey={rowKey}
              onRowClick={row => selectEntity({ type: entityType, id: rowKey(row) })}
              selectedKey={selectedEntity?.id ?? null}
            />
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
