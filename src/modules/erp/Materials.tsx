import { useMemo } from 'react'
import { Package, Layers } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type { Material, MaterialType, Bom } from '../../data/erp/types'

/** Per-type visual treatment for the material-type chip + legend. */
const TYPE_META: Record<MaterialType, { label: string; chip: string; dot: string; text: string }> = {
  FERT: { label: 'FERT', chip: 'bg-accent/15 text-accent border-accent/30', dot: 'bg-accent', text: 'text-accent' },
  HALB: { label: 'HALB', chip: 'bg-accent-3/15 text-accent-3 border-accent-3/30', dot: 'bg-accent-3', text: 'text-accent-3' },
  ROH: { label: 'ROH', chip: 'bg-ink-3/15 text-ink-3 border-edge', dot: 'bg-ink-mute', text: 'text-ink-3' },
}

/** Small colored chip for the material type. */
function TypeChip({ type }: { type: MaterialType }) {
  const m = TYPE_META[type]
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-semibold uppercase tracking-wide font-mono',
        m.chip,
      )}
    >
      {m.label}
    </span>
  )
}

/** Format a per-unit standard cost as a fixed-width mono currency string. */
function fmtCost(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Label/value pair in the drill-in detail grid (mirrors Production's drill-in). */
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

export function MaterialsModule({ erpData, eventBus: _eventBus }: ErpModuleProps) {
  const { materials, boms } = erpData

  // Stable per-header lookup so a FERT detail can pull its BOM components.
  const bomByMaterial = useMemo(() => {
    const m = new Map<string, Bom>()
    for (const b of boms) m.set(b.headerMaterialNo, b)
    return m
  }, [boms])

  // Type breakdown for the subtitle + header legend.
  const counts = useMemo(() => {
    const c: Record<MaterialType, number> = { FERT: 0, HALB: 0, ROH: 0 }
    for (const mat of materials) c[mat.type]++
    return c
  }, [materials])

  const columns: Column<Material>[] = useMemo(() => [
    {
      key: 'materialNo', header: 'Material', width: 130, mono: true,
      render: r => r.materialNo,
      sortFn: (a, b) => a.materialNo.localeCompare(b.materialNo),
    },
    {
      key: 'type', header: 'Type', width: 80,
      render: r => <TypeChip type={r.type} />,
      sortFn: (a, b) => a.type.localeCompare(b.type),
    },
    {
      key: 'description', header: 'Description', width: 260,
      render: r => r.description,
      sortFn: (a, b) => a.description.localeCompare(b.description),
    },
    {
      key: 'materialGroup', header: 'Group', width: 130,
      render: r => r.materialGroup,
      sortFn: (a, b) => a.materialGroup.localeCompare(b.materialGroup),
    },
    {
      key: 'baseUoM', header: 'UoM', width: 70, mono: true,
      render: r => r.baseUoM,
      sortFn: (a, b) => a.baseUoM.localeCompare(b.baseUoM),
    },
    {
      key: 'standardCost', header: 'Std Cost', width: 110, mono: true,
      render: r => (
        <span className="block w-full text-right font-mono tabular-nums">{fmtCost(r.standardCost)}</span>
      ),
      sortFn: (a, b) => a.standardCost - b.standardCost,
    },
  ], [])

  const headerRight = (
    <div className="flex items-center gap-3">
      {(['FERT', 'HALB', 'ROH'] as MaterialType[]).map(t => (
        <span key={t} className={cn('flex items-center gap-1.5 text-[10px]', TYPE_META[t].text)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', TYPE_META[t].dot)} aria-hidden />
          {TYPE_META[t].label}
          <span className="font-mono tabular-nums text-ink-3">{counts[t]}</span>
        </span>
      ))}
    </div>
  )

  const subtitle =
    `${materials.length.toLocaleString()} materials · ` +
    `${counts.FERT} FERT / ${counts.HALB} HALB / ${counts.ROH} ROH`

  const renderDetail = (row: Material) => {
    const bom = row.type === 'FERT' ? bomByMaterial.get(row.materialNo) : undefined
    return (
      <div className="space-y-5 text-xs">
        <section>
          <SectionTitle icon={<Package size={13} strokeWidth={1.9} />} text="Basic Data" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Material" value={row.materialNo} mono />
            <DetailField label="Type" value={<TypeChip type={row.type} />} />
            <DetailField label="Material Group" value={row.materialGroup} />
            <DetailField label="Base UoM" value={row.baseUoM} mono />
            {row.productCode && <DetailField label="Product Code" value={row.productCode} mono />}
          </div>
        </section>

        <section>
          <SectionTitle icon={<Layers size={13} strokeWidth={1.9} />} text="Valuation" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Standard Cost" value={fmtCost(row.standardCost)} mono />
            <DetailField label="Valuation Class" value={row.valuationClass} mono />
            <DetailField label="Plant" value={row.plant} mono />
            <DetailField label="Lead Time" value={`${row.leadTimeDays} d`} mono />
          </div>
        </section>

        {row.type === 'FERT' && (
          <section>
            <SectionTitle icon={<Layers size={13} strokeWidth={1.9} />} text="Bill of Materials" />
            {bom && bom.components.length > 0 ? (
              <div className="mt-2 rounded-md border border-edge overflow-hidden">
                {bom.components.map((c, i) => (
                  <div
                    key={`${c.materialNo}-${i}`}
                    className="flex items-center gap-2.5 py-1.5 pl-3 pr-2.5 border-b border-edge last:border-b-0 hover:bg-surface-3/50 transition-colors"
                  >
                    <span className="font-mono tabular-nums text-[11px] text-accent shrink-0 w-24 truncate">{c.materialNo}</span>
                    <span className="flex-1 truncate text-ink-2">{c.description}</span>
                    <span className="text-ink-1 font-mono tabular-nums text-[11px] shrink-0">{c.qty}</span>
                    <span className="text-ink-3 font-mono text-[10px] shrink-0 w-9 text-right">{c.uom}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-ink-3">No BOM defined for this finished good yet.</p>
            )}
          </section>
        )}
      </div>
    )
  }

  return (
    <MasterDataModule
      title="Materials"
      subtitle={subtitle}
      icon={<Package size={15} strokeWidth={1.9} />}
      data={materials}
      columns={columns}
      rowKey={r => r.materialNo}
      entityType="material"
      headerRight={headerRight}
      renderDetail={renderDetail}
      detailTitle={r => r.materialNo}
      detailSubtitle={r => r.description}
    />
  )
}
