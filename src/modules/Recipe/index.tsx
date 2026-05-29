import { useMemo } from 'react'
import {
  Boxes,
  Cpu,
  Layers,
  Hexagon,
  Server,
  GitCommitVertical,
  ArrowRight,
  ScrollText,
  ClipboardList,
} from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import type { MasterData } from '../../data/master'
import type { Recipe } from '../../data/master/recipes'

interface RecipeModuleProps {
  masterData: MasterData
}

type BumpType = 'major' | 'minor' | 'patch' | 'initial'

/** Parse a 'vX.Y.Z' string into [major, minor, patch] numbers (missing parts -> 0). */
function parseVersion(v: string): [number, number, number] {
  const cleaned = v.trim().replace(/^v/i, '')
  const [major = 0, minor = 0, patch = 0] = cleaned
    .split('.')
    .map(n => {
      const parsed = parseInt(n, 10)
      return Number.isNaN(parsed) ? 0 : parsed
    })
  return [major, minor, patch]
}

/** Classify the semantic jump between a previous and current version string. */
function bumpType(prev: string, curr: string): Exclude<BumpType, 'initial'> {
  const [pMaj, pMin] = parseVersion(prev)
  const [cMaj, cMin] = parseVersion(curr)
  if (pMaj !== cMaj) return 'major'
  if (pMin !== cMin) return 'minor'
  return 'patch'
}

/** Color + short label for each bump type. */
const BUMP_META: Record<BumpType, { color: string; label: string }> = {
  major: { color: '#22D3EE', label: 'MAJOR' },
  minor: { color: '#38BDF8', label: 'MINOR' },
  patch: { color: '#818CF8', label: 'PATCH' },
  initial: { color: '#64748B', label: 'INITIAL' },
}

/** Small lucide glyph keyed by tool-type group (decorative only). */
function ToolTypeIcon({ type }: { type: string }) {
  const common = { size: 13, strokeWidth: 1.9 }
  switch (type) {
    case 'LITHO':
      return <Layers {...common} />
    case 'ETCH':
      return <Cpu {...common} />
    case 'CMP':
      return <Hexagon {...common} />
    case 'CVD':
    case 'PVD':
      return <Server {...common} />
    case 'INSP':
      return <Boxes {...common} />
    default:
      return <Boxes {...common} />
  }
}

export function RecipeModule({ masterData }: RecipeModuleProps) {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const grouped = useMemo(() => {
    const groups: Record<string, Recipe[]> = {}
    for (const recipe of masterData.recipes) {
      const type = recipe.toolType
      if (!groups[type]) groups[type] = []
      groups[type].push(recipe)
    }
    return groups
  }, [masterData])

  const selectedRecipe = selectedEntity?.type === 'recipe'
    ? masterData.recipes.find(r => r.recipeId === selectedEntity.id)
    : null

  return (
    <div className="flex h-full gap-4 p-4 bg-canvas">
      {/* ───────────────────────── Recipe library ───────────────────────── */}
      <Panel className="w-72 shrink-0 flex flex-col overflow-hidden">
        <PanelHeader
          title="Recipe Library"
          icon={<ScrollText size={15} strokeWidth={1.9} />}
          right={
            <span className="metric-value text-[11px] text-accent text-glow-soft tabular-nums">
              {masterData.recipes.length}
            </span>
          }
        />
        <div className="flex-1 overflow-y-auto">
          {Object.entries(grouped).map(([type, recipes]) => (
            <div key={type}>
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-3/50 border-b border-edge text-ink-3">
                <ToolTypeIcon type={type} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{type}</span>
                <span className="ml-auto metric-value text-[10px] text-ink-mute tabular-nums">
                  {recipes.length}
                </span>
              </div>
              {recipes.map(recipe => {
                const isSelected = selectedEntity?.id === recipe.recipeId
                return (
                  <button
                    key={recipe.recipeId}
                    className={cn(
                      'relative w-full text-left pl-4 pr-3 py-2 border-b border-edge/60',
                      'cursor-pointer transition-colors duration-150',
                      isSelected
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-surface-3 text-ink-2',
                    )}
                    onClick={() => selectEntity({ type: 'recipe', id: recipe.recipeId })}
                  >
                    {isSelected && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent"
                        style={{ boxShadow: '0 0 8px rgba(34, 211, 238, 0.7)' }}
                        aria-hidden
                      />
                    )}
                    <div className={cn('font-mono text-xs', isSelected ? 'text-accent' : 'text-ink-1')}>
                      {recipe.recipeId}
                    </div>
                    <div className="font-mono text-[10px] text-ink-3 mt-0.5">{recipe.currentVersion}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </Panel>

      {/* ───────────────────────── Recipe detail ───────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selectedRecipe && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-3">
            <ScrollText size={32} strokeWidth={1.5} className="text-ink-mute" />
            <div className="text-xs font-mono uppercase tracking-[0.14em]">
              Select a recipe from the library
            </div>
          </div>
        )}

        {selectedRecipe && (
          <div className="space-y-4 animate-rise">
            {/* Title */}
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-semibold text-ink-1 text-glow-soft">
                {selectedRecipe.recipeName}
              </h1>
              <span className="metric-value text-sm text-accent text-glow-soft">
                {selectedRecipe.currentVersion}
              </span>
            </div>

            {/* Parameters */}
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Parameters"
                icon={<ClipboardList size={15} strokeWidth={1.9} />}
                right={
                  <span className="metric-value text-[11px] text-ink-3 tabular-nums">
                    {Object.keys(selectedRecipe.parameters).length}
                  </span>
                }
              />
              <div className="font-mono text-xs">
                {Object.entries(selectedRecipe.parameters).map(([key, value], i) => (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center px-3.5 py-1.5',
                      i % 2 === 0 ? 'bg-surface-2' : 'bg-surface-3/40',
                    )}
                  >
                    <span className="w-56 text-ink-3 normal-case">{key}</span>
                    <span className="text-ink-1">{value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Latest-change diff summary (only when there is a delta to show) */}
            {selectedRecipe.versions.length >= 2 && (() => {
              const all = selectedRecipe.versions
              const prevVer = all[all.length - 2]
              const currVer = all[all.length - 1]
              const bump = bumpType(prevVer.version, currVer.version)
              const meta = BUMP_META[bump]
              return (
                <div className="flex flex-wrap items-center gap-3 px-3.5 py-3 panel">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                    Latest change
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-ink-3">{prevVer.version}</span>
                    <ArrowRight size={13} strokeWidth={2} className="text-ink-mute" />
                    <span className="text-accent text-glow-soft">{currVer.version}</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.12em] font-mono"
                    style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-ink-2 text-xs min-w-0 truncate">{currVer.changeNote}</span>
                </div>
              )
            })()}

            {/* Version Timeline (commit-graph) — subsumes the old sign-off chain */}
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Version History"
                icon={<GitCommitVertical size={15} strokeWidth={1.9} />}
                right={
                  <span className="metric-value text-[11px] text-ink-3 tabular-nums">
                    {selectedRecipe.versions.length}
                  </span>
                }
              />
              <div>
                {selectedRecipe.versions
                  .map((ver, idx) => {
                    // Bump is relative to the chronological predecessor; oldest = 'initial'.
                    const bump: BumpType =
                      idx === 0
                        ? 'initial'
                        : bumpType(selectedRecipe.versions[idx - 1].version, ver.version)
                    return { ver, bump, idx }
                  })
                  // Newest first for display.
                  .reverse()
                  .map(({ ver, bump, idx }, rowIdx, rows) => {
                    const meta = BUMP_META[bump]
                    const isCurrent = ver.version === selectedRecipe.currentVersion
                    const isFirstRow = rowIdx === 0
                    const isLastRow = rowIdx === rows.length - 1
                    return (
                      <div
                        key={`${ver.version}-${idx}`}
                        className="group relative flex items-stretch gap-3 px-3.5 py-2.5 border-b border-edge last:border-b-0 transition-colors hover:bg-surface-3/40"
                      >
                        {/* Connector + node rail */}
                        <div className="relative w-4 shrink-0 flex justify-center">
                          {/* connector line segments (hidden at the rail's open ends) */}
                          <span
                            className={cn(
                              'absolute left-1/2 -translate-x-1/2 w-px bg-edge-strong',
                              isFirstRow ? 'top-1/2' : 'top-0',
                              isLastRow ? 'bottom-1/2' : 'bottom-0',
                            )}
                            aria-hidden
                          />
                          {/* node */}
                          <span
                            className="relative z-10 mt-1 rounded-full border"
                            style={{
                              width: isCurrent ? 13 : 9,
                              height: isCurrent ? 13 : 9,
                              backgroundColor: meta.color,
                              borderColor: meta.color,
                              boxShadow: isCurrent ? `0 0 0 3px ${meta.color}33, 0 0 10px ${meta.color}aa` : 'none',
                            }}
                            aria-hidden
                          />
                        </div>

                        {/* Version content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'font-mono text-xs',
                                isCurrent ? 'text-accent text-glow-soft font-semibold' : 'text-ink-1',
                              )}
                            >
                              {ver.version}
                            </span>
                            {isCurrent && (
                              <span
                                className="px-1.5 py-px rounded text-[9px] font-semibold tracking-[0.14em] font-mono"
                                style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                              >
                                CURRENT
                              </span>
                            )}
                            <span className="px-1.5 py-px rounded bg-surface-3 font-mono text-[10px] text-ink-2">
                              {ver.author}
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-ink-3 tabular-nums shrink-0">
                              {ver.timestamp}
                            </span>
                          </div>
                          <div className="text-ink-2 text-xs mt-0.5">{ver.changeNote}</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
