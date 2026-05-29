import { Boxes, MapPin, PackageCheck, AlertTriangle } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import type { InventoryRow } from '../../data/erp/types'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'

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

const columns: Column<InventoryRow>[] = [
  {
    key: 'materialNo', header: 'Material', width: 150, mono: true,
    render: r => r.materialNo,
    sortFn: (a, b) => a.materialNo.localeCompare(b.materialNo),
  },
  {
    key: 'description', header: 'Description', width: 230,
    render: r => r.description,
    sortFn: (a, b) => a.description.localeCompare(b.description),
  },
  {
    key: 'storageLoc', header: 'Storage Loc', width: 120,
    render: r => <StorageChip loc={r.storageLoc} />,
    sortFn: (a, b) => a.storageLoc.localeCompare(b.storageLoc),
  },
  {
    key: 'onHand', header: 'On Hand', width: 100,
    render: r => <StockNumber value={r.onHand} />,
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
]

/**
 * Inventory & Stock — material × storage-location stock browser.
 * Table + drill-in via the shared MasterDataModule; shortages (available <= 0)
 * glow red in the grid and surface as a header count.
 */
export function InventoryModule({ erpData }: ErpModuleProps) {
  const rows = erpData.inventory
  const shortages = rows.reduce((n, r) => (isShort(r) ? n + 1 : n), 0)

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

  return (
    <MasterDataModule
      title="Inventory · Stock"
      subtitle="Material stock by storage location"
      icon={<Boxes size={15} strokeWidth={1.9} />}
      data={rows}
      columns={columns}
      rowKey={r => `${r.materialNo}·${r.storageLoc}`}
      entityType="material"
      headerRight={headerRight}
      detailTitle={r => r.materialNo}
      detailSubtitle={r => r.description}
      renderDetail={r => {
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
      }}
    />
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
