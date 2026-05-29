import { useMemo, useState } from 'react'
import { ListTree, GitBranch, Package, Boxes, ChevronRight, Search } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type { Bom, Material } from '../../data/erp/types'

/** Small type chip for a material (FERT / HALB / ROH), color-coded. */
function TypeChip({ type }: { type: Material['type'] }) {
  const map: Record<Material['type'], { label: string; cls: string }> = {
    FERT: { label: 'FERT', cls: 'bg-accent/15 text-accent border-accent/30' },
    HALB: { label: 'HALB', cls: 'bg-accent-3/15 text-accent-3 border-accent-3/30' },
    ROH: { label: 'ROH', cls: 'bg-surface-3 text-ink-3 border-edge' },
  }
  const s = map[type] ?? map.ROH
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-semibold uppercase tracking-[0.1em] shrink-0',
        s.cls,
      )}
    >
      {s.label}
    </span>
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

export function BomModule({ erpData }: ErpModuleProps) {
  const { boms, materials } = erpData
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Fast lookup from materialNo -> Material for header type / component enrichment.
  const materialByNo = useMemo(() => {
    const m = new Map<string, Material>()
    for (const mat of materials) m.set(mat.materialNo, mat)
    return m
  }, [materials])

  const sortedBoms = useMemo(
    () => [...boms].sort((a, b) => a.headerMaterialNo.localeCompare(b.headerMaterialNo)),
    [boms],
  )

  const filteredBoms = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedBoms
    return sortedBoms.filter(
      b =>
        b.headerMaterialNo.toLowerCase().includes(q) ||
        b.headerDescription.toLowerCase().includes(q) ||
        b.bomId.toLowerCase().includes(q),
    )
  }, [sortedBoms, query])

  const selected: Bom | null = useMemo(
    () => (selectedId ? boms.find(b => b.bomId === selectedId) ?? null : null),
    [boms, selectedId],
  )

  const headerMaterial = selected ? materialByNo.get(selected.headerMaterialNo) ?? null : null

  return (
    <div className="flex h-full">
      {/* Left: BOM list */}
      <div className="w-72 shrink-0 p-4 pr-2 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader
            title="Bill of Materials"
            subtitle={`${boms.length.toLocaleString()} structures`}
            icon={<ListTree size={15} strokeWidth={1.9} />}
          />

          {/* Filter */}
          <div className="px-3 py-2.5 border-b border-edge">
            <div className="relative flex items-center">
              <Search size={13} strokeWidth={1.9} className="absolute left-2.5 text-ink-3 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter materials…"
                className="w-full bg-surface-2 border border-edge rounded-md pl-7 pr-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent transition-colors"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredBoms.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Search size={20} strokeWidth={1.6} className="text-ink-3" />
                <div className="text-xs text-ink-2">No structures match that filter</div>
                <div className="text-[11px] text-ink-3">Try a different material number.</div>
              </div>
            ) : (
              filteredBoms.map(bom => {
                const active = bom.bomId === selectedId
                const mat = materialByNo.get(bom.headerMaterialNo)
                return (
                  <button
                    key={bom.bomId}
                    onClick={() => setSelectedId(bom.bomId)}
                    className={cn(
                      'group relative w-full text-left flex items-center gap-2 pl-3 pr-2 py-2 border-b border-edge transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
                      active ? 'bg-accent/10' : 'hover:bg-surface-3/50',
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                        style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                        aria-hidden
                      />
                    )}
                    <Package
                      size={14}
                      strokeWidth={1.9}
                      className={cn('shrink-0', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'font-mono text-[11px] truncate leading-tight',
                          active ? 'text-accent' : 'text-ink-1',
                        )}
                      >
                        {bom.headerMaterialNo}
                      </div>
                      <div className="text-[10px] text-ink-3 truncate mt-0.5">{bom.headerDescription}</div>
                    </div>
                    {mat && <TypeChip type={mat.type} />}
                  </button>
                )
              })
            )}
          </div>
        </Panel>
      </div>

      {/* Right: BOM tree */}
      <div className="flex-1 p-4 pl-2 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          {!selected ? (
            <>
              <PanelHeader title="Structure" icon={<GitBranch size={15} strokeWidth={1.9} />} />
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="relative flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-accent/10 blur-xl" aria-hidden />
                  <ListTree size={34} strokeWidth={1.4} className="text-accent relative text-glow-soft" />
                </div>
                <div className="text-sm text-ink-2 font-medium">Select a BOM</div>
                <div className="text-xs text-ink-3 max-w-[15rem]">
                  Pick a finished material on the left to explore its bill of materials and component tree.
                </div>
              </div>
            </>
          ) : (
            <>
              <PanelHeader
                title={selected.headerMaterialNo}
                subtitle={selected.headerDescription}
                icon={<GitBranch size={15} strokeWidth={1.9} />}
                right={
                  <span className="flex items-center gap-1.5 text-[10px] text-ink-3 uppercase tracking-[0.12em]">
                    <span className="font-mono metric-value text-ink-1 normal-case tracking-normal">
                      {selected.components.length}
                    </span>
                    components
                  </span>
                }
              />

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {/* Header / parent node */}
                <div>
                  <SectionTitle icon={<GitBranch size={13} strokeWidth={1.9} />} text="Component Tree" />
                  <div className="mt-2.5 rounded-md border border-edge overflow-hidden">
                    {/* Header material row */}
                    <div className="relative flex items-center gap-2.5 py-2.5 px-3 bg-surface-2 border-b border-edge">
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                        style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                        aria-hidden
                      />
                      <Boxes size={16} strokeWidth={1.9} className="text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] text-ink-1 truncate leading-tight">
                          {selected.headerMaterialNo}
                        </div>
                        <div className="text-[11px] text-ink-3 truncate mt-0.5">{selected.headerDescription}</div>
                      </div>
                      {headerMaterial && <TypeChip type={headerMaterial.type} />}
                    </div>

                    {/* Component rows (indented, accent rails) */}
                    {selected.components.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
                        <Package size={18} strokeWidth={1.6} className="text-ink-3" />
                        <div className="text-xs text-ink-2">No components on this structure</div>
                        <div className="text-[11px] text-ink-3">This material is sourced directly.</div>
                      </div>
                    ) : (
                      selected.components.map((c, i) => {
                        const mat = materialByNo.get(c.materialNo)
                        const last = i === selected.components.length - 1
                        return (
                          <div
                            key={`${c.materialNo}-${i}`}
                            className="group relative flex items-center gap-2 py-2 pl-3 pr-3 border-b border-edge last:border-b-0 hover:bg-surface-3/50 transition-colors"
                          >
                            {/* Tree rail: vertical + elbow connector */}
                            <span className="relative shrink-0 w-6 self-stretch" aria-hidden>
                              <span
                                className={cn(
                                  'absolute left-2.5 top-0 w-px bg-edge-strong',
                                  last ? 'h-1/2' : 'h-full',
                                )}
                              />
                              <span className="absolute left-2.5 top-1/2 w-2.5 h-px bg-edge-strong" />
                              <span className="absolute left-[18px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-accent-2" />
                            </span>
                            <div className="min-w-0 flex-1 flex items-baseline gap-2">
                              <span className="font-mono text-[11px] text-ink-1 shrink-0">{c.materialNo}</span>
                              <span className="text-[11px] text-ink-2 truncate">{c.description}</span>
                            </div>
                            {mat && <TypeChip type={mat.type} />}
                            <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-ink-2 shrink-0">
                              <ChevronRight
                                size={11}
                                strokeWidth={1.9}
                                className="text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-hidden
                              />
                              {c.qty}
                              <span className="text-ink-3 uppercase text-[10px]">{c.uom}</span>
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* BOM meta */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs pt-1">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">BOM ID</div>
                    <div className="text-ink-1 font-mono truncate">{selected.bomId}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Header Material</div>
                    <div className="text-ink-1 font-mono truncate">{selected.headerMaterialNo}</div>
                  </div>
                  {headerMaterial && (
                    <>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Plant</div>
                        <div className="text-ink-1 truncate">{headerMaterial.plant}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Base UoM</div>
                        <div className="text-ink-1 font-mono truncate">{headerMaterial.baseUoM}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
