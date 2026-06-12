import { useMemo, useState } from 'react'
import { Boxes, MapPin, PackageCheck, AlertTriangle, Warehouse, Activity } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { Heatbar } from '../../components/ui/Heatbar'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { TickerTape } from '../../components/ui/TickerTape'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { brand } from '../../lib/tokens'
import type { InventoryRow } from '../../data/erp/types'
import type { ErpModuleProps } from './types'
import { locationOccupancy, type LocationOccupancy } from './erpViz'

/** Right-aligned mono number; glows red + flags shortage when available <= 0. */
function StockNumber({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <span
      className={cn(
        'block w-full text-right font-mono tabular-nums',
        danger ? 'text-critical text-glow-soft font-semibold' : 'text-ink-2',
      )}
    >
      {value.toLocaleString()}
    </span>
  )
}

/** Storage-location chip (SAP-style org cue). */
function StorageChip({ loc }: { loc: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-surface-3 border border-edge text-[10px] font-mono text-ink-2">
      <MapPin size={9} strokeWidth={2} className="text-ink-3 shrink-0" aria-hidden />
      {loc}
    </span>
  )
}

/** Label/value pair in the drill-in detail grid (Production drill-in style). */
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

/** Uppercase tracked section heading with a small accent icon. */
function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      <span className="text-accent flex items-center">{icon}</span>
      {text}
    </div>
  )
}

const isShort = (r: InventoryRow) => r.available <= 0

/**
 * Hero storage-location occupancy mosaic: one SVG tile per storage location,
 * fill intensity = share of total on-hand quantity, cyan glow on the location of
 * the selected/active row. Clicking a tile filters the table to that location.
 */
function OccupancyMosaic({
  occupancy,
  maxShare,
  activeLoc,
  onSelect,
}: {
  occupancy: LocationOccupancy[]
  maxShare: number
  activeLoc: string | null
  onSelect: (loc: string) => void
}) {
  const cols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(occupancy.length))))
  const gap = 6
  const tile = 30
  const rows = Math.ceil(occupancy.length / cols)
  const width = cols * tile + (cols - 1) * gap
  const height = rows * tile + (rows - 1) * gap

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Storage-location occupancy mosaic"
      style={{ maxHeight: height }}
    >
      {occupancy.map((o, i) => {
        const cx = (i % cols) * (tile + gap)
        const cy = Math.floor(i / cols) * (tile + gap)
        // Intensity 0.1..1 scaled to the busiest location, so even small tiles read.
        const intensity = maxShare > 0 ? 0.12 + 0.88 * (o.share / maxShare) : 0.12
        const active = o.loc === activeLoc
        return (
          <g
            key={o.loc}
            transform={`translate(${cx}, ${cy})`}
            onClick={() => onSelect(o.loc)}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${o.loc} · ${o.qty.toLocaleString()} on hand · ${o.skuCount} SKU · ${(o.share * 100).toFixed(1)}%`}</title>
            <rect
              width={tile}
              height={tile}
              rx={4}
              fill={brand.primary}
              fillOpacity={intensity * 0.85}
              stroke={active ? brand.primary : 'rgba(56,189,248,0.18)'}
              strokeWidth={active ? 1.6 : 1}
              filter={active ? 'url(#fpTileGlow)' : undefined}
            />
            <text
              x={tile / 2}
              y={tile / 2 + 3}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily="JetBrains Mono, monospace"
              fill="#E8EEF7"
              fillOpacity={0.92}
              style={{ pointerEvents: 'none' }}
            >
              {o.loc}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function InventoryModule({ erpData, eventBus }: ErpModuleProps) {
  const rows = erpData.inventory
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const [locFilter, setLocFilter] = useState<string | null>(null)

  const shortages = useMemo(() => rows.reduce((n, r) => (isShort(r) ? n + 1 : n), 0), [rows])
  const occupancy = useMemo(() => locationOccupancy(rows), [rows])
  const maxShare = useMemo(() => occupancy.reduce((m, o) => Math.max(m, o.share), 0), [occupancy])
  const maxOnHand = useMemo(() => rows.reduce((m, r) => Math.max(m, r.onHand), 1), [rows])
  const totalOnHand = useMemo(() => rows.reduce((s, r) => s + Math.max(0, r.onHand), 0), [rows])

  const rowKey = (r: InventoryRow) => `${r.materialNo}·${r.storageLoc}`

  const selectedRow =
    selectedEntity?.type === 'material'
      ? rows.find(r => rowKey(r) === selectedEntity.id) ?? null
      : null

  // The mosaic glows on the selected row's location, else the tile filter.
  const activeLoc = selectedRow?.storageLoc ?? locFilter

  const filtered = useMemo(
    () => (locFilter ? rows.filter(r => r.storageLoc === locFilter) : rows),
    [rows, locFilter],
  )

  const columns: Column<InventoryRow>[] = useMemo(() => [
    {
      key: 'materialNo', header: 'Material', width: 150, mono: true,
      render: r => r.materialNo,
      sortFn: (a, b) => a.materialNo.localeCompare(b.materialNo),
    },
    {
      key: 'description', header: 'Description', width: 220, flex: true,
      render: r => r.description,
      sortFn: (a, b) => a.description.localeCompare(b.description),
    },
    {
      key: 'storageLoc', header: 'Storage Loc', width: 120,
      render: r => <StorageChip loc={r.storageLoc} />,
      sortFn: (a, b) => a.storageLoc.localeCompare(b.storageLoc),
    },
    {
      key: 'onHand', header: 'On Hand', width: 160,
      render: r => (
        <div className="flex items-center gap-2 w-full">
          <span className="font-mono tabular-nums text-right w-[64px] shrink-0 text-ink-2">{r.onHand.toLocaleString()}</span>
          <Heatbar value={Math.max(0, r.onHand)} max={maxOnHand} tone="auto" className="flex-1" />
        </div>
      ),
      sortFn: (a, b) => a.onHand - b.onHand,
    },
    {
      key: 'committed', header: 'Committed', width: 100,
      render: r => <StockNumber value={r.committed} />,
      sortFn: (a, b) => a.committed - b.committed,
    },
    {
      key: 'available', header: 'Available', width: 100,
      render: r => <StockNumber value={r.available} danger={isShort(r)} />,
      sortFn: (a, b) => a.available - b.available,
    },
  ], [maxOnHand])

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
        <Boxes size={12} strokeWidth={1.9} className="text-ink-mute" aria-hidden />
        <span className="font-mono tabular-nums text-ink-2">{rows.length.toLocaleString()}</span>
        SKUs
      </span>
      {shortages > 0 ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-critical/15 text-critical border border-critical/30">
          <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse-soft shrink-0" aria-hidden />
          <span className="font-mono tabular-nums">{shortages}</span> Short
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-success/10 text-success border border-success/25">
          <PackageCheck size={11} strokeWidth={2} className="shrink-0" aria-hidden />
          Covered
        </span>
      )}
    </div>
  )

  const renderDetail = (r: InventoryRow) => {
    const short = isShort(r)
    return (
      <div className="space-y-5 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="Material" value={r.materialNo} mono />
          <DetailField label="Plant" value={r.plant} mono />
          <DetailField label="Storage Loc" value={<StorageChip loc={r.storageLoc} />} />
          <DetailField label="Description" value={r.description} />
        </div>

        <section>
          <SectionTitle icon={<Boxes size={13} strokeWidth={1.9} />} text="Stock Breakdown" />
          <div className="mt-2 rounded-md border border-edge overflow-hidden">
            <StockRow label="On Hand" value={r.onHand} />
            <StockRow label="Committed" value={r.committed} />
            <StockRow label="Available" value={r.available} danger={short} last />
          </div>
        </section>

        {short ? (
          <div className="flex items-center gap-2 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
            <AlertTriangle size={13} strokeWidth={2} className="shrink-0" aria-hidden />
            <span>Stock shortage — no quantity available to commit.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-[11px] text-success">
            <PackageCheck size={13} strokeWidth={2} className="shrink-0" aria-hidden />
            <span>{r.available.toLocaleString()} available to commit.</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-bloom" aria-hidden />
      <div className="relative z-[1] flex flex-col flex-1 min-h-0 p-4 gap-3">
        <ModuleHeader
          domain="ERP"
          icon={<Boxes size={13} strokeWidth={2} />}
          title="Inventory · Stock"
          subtitle="Material stock by storage location"
          pills={[
            { label: 'On Hand', value: <AnimatedNumber value={totalOnHand} />, tone: 'accent' },
            { label: 'Locations', value: <AnimatedNumber value={occupancy.length} />, tone: 'info' },
            { label: 'Short', value: <AnimatedNumber value={shortages} />, tone: shortages > 0 ? 'critical' : 'success' },
          ]}
          right={headerRight}
        />

        {/* Hero occupancy mosaic + live movement ticker */}
        <Panel className="shrink-0 animate-rise overflow-hidden" style={{ animationDelay: '100ms' }}>
          <PanelHeader
            title="Storage Occupancy"
            subtitle={locFilter ? `Filtered · ${locFilter}` : 'Fill intensity = on-hand share · click a tile to filter'}
            icon={<Warehouse size={15} strokeWidth={1.9} />}
            right={
              locFilter ? (
                <button
                  type="button"
                  onClick={() => setLocFilter(null)}
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-surface-3 border border-edge text-ink-2 hover:text-ink-1 hover:border-accent/40 transition-colors"
                >
                  Clear filter
                </button>
              ) : undefined
            }
          />
          <div className="px-3.5 py-3" style={{ maxHeight: 200 }}>
            <OccupancyMosaic
              occupancy={occupancy}
              maxShare={maxShare}
              activeLoc={activeLoc}
              onSelect={loc => setLocFilter(prev => (prev === loc ? null : loc))}
            />
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 border-t border-edge bg-surface-3/30">
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3 shrink-0">
              <Activity size={11} strokeWidth={2} className="text-accent" aria-hidden />
              Movements
            </span>
            <div className="flex-1 min-w-0">
              <TickerTape source$={eventBus.all$()} accept={['erp.goods.movement']} />
            </div>
          </div>
        </Panel>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 animate-rise" style={{ animationDelay: '160ms' }}>
            <Panel className="flex flex-col h-full overflow-hidden" data-tour="inventory.table">
              <PanelHeader
                title="Stock Browser"
                subtitle="On-hand intensity · availability"
                icon={<Boxes size={15} strokeWidth={1.9} />}
              />
              <div className="flex-1 min-h-0">
                <DenseDataTable
                  data={filtered}
                  columns={columns}
                  rowKey={rowKey}
                  onRowClick={row => selectEntity({ type: 'material', id: rowKey(row) })}
                  selectedKey={selectedEntity?.id ?? null}
                  emptyMessage={locFilter ? `No stock in ${locFilter}` : 'No data available'}
                />
              </div>
            </Panel>
          </div>

          {selectedRow && (
            <DrillInPanel title={selectedRow.materialNo} subtitle={selectedRow.description}>
              {renderDetail(selectedRow)}
            </DrillInPanel>
          )}
        </div>
      </div>
    </div>
  )
}

/** One line of the stock-breakdown table in the drill-in. */
function StockRow({ label, value, danger, last }: { label: string; value: number; danger?: boolean; last?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-between py-1.5 pl-3 pr-2.5 transition-colors',
        !last && 'border-b border-edge',
        danger ? 'bg-critical/10' : 'hover:bg-surface-3/50',
      )}
    >
      {danger && (
        <span
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-critical"
          style={{ boxShadow: '0 0 8px rgba(248, 113, 113, 0.55)' }}
          aria-hidden
        />
      )}
      <span className={cn('text-[10px] uppercase tracking-[0.12em]', danger ? 'text-critical' : 'text-ink-3')}>
        {label}
      </span>
      <span
        className={cn(
          'font-mono tabular-nums',
          danger ? 'text-critical text-glow-soft font-semibold' : 'text-ink-1',
        )}
      >
        {value.toLocaleString()}
      </span>
    </div>
  )
}
