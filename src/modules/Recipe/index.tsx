import { useMemo } from 'react'
import {
  Boxes,
  Cpu,
  Layers,
  Hexagon,
  Server,
  GitBranch,
  ScrollText,
  ClipboardList,
  Users,
} from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import type { MasterData } from '../../data/master'
import type { Recipe } from '../../data/master/recipes'

interface RecipeModuleProps {
  masterData: MasterData
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

            {/* Version diff */}
            {selectedRecipe.versions.length >= 2 && (
              <Panel className="overflow-hidden">
                <PanelHeader
                  title="Version History"
                  subtitle="Latest change"
                  icon={<GitBranch size={15} strokeWidth={1.9} />}
                />
                <div className="font-mono text-xs">
                  {selectedRecipe.versions.slice(-2).map((ver, i) => {
                    const isNew = i === 1
                    return (
                      <div
                        key={ver.version}
                        className={cn(
                          'px-3.5 py-2 border-l-2',
                          isNew
                            ? 'bg-e10-prod/10 border-l-e10-prod'
                            : 'bg-critical/10 border-l-critical',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn('font-semibold', isNew ? 'text-e10-prod' : 'text-critical')}>
                            <span className="inline-block w-3.5">{isNew ? '+' : '−'}</span>
                            {ver.version}
                          </span>
                          <span className="text-ink-2">{ver.author}</span>
                        </div>
                        <div className="text-ink-3 mt-1 pl-3.5">{ver.changeNote}</div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )}

            {/* Sign-off chain */}
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Sign-off Chain"
                icon={<Users size={15} strokeWidth={1.9} />}
                right={
                  <span className="metric-value text-[11px] text-ink-3 tabular-nums">
                    {selectedRecipe.versions.length}
                  </span>
                }
              />
              <div>
                {selectedRecipe.versions.map(ver => (
                  <div
                    key={ver.version}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs border-b border-edge/60 last:border-b-0"
                  >
                    <span className="font-mono text-accent">{ver.version}</span>
                    <span className="text-ink-3">by</span>
                    <span className="font-mono text-ink-2">{ver.author}</span>
                    <span className="font-mono text-ink-3 ml-auto tabular-nums">{ver.timestamp}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
