import { useMemo } from 'react'
import { useUiStore } from '../../lib/uiStore'
import type { MasterData } from '../../data/master'
import type { Recipe } from '../../data/master/recipes'

interface RecipeModuleProps {
  masterData: MasterData
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
    <div className="flex h-full">
      <div className="w-72 border-r border-[#D1D5DB] bg-white overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-[#6B7280] border-b border-[#E5E7EB]">
          Recipe Library &mdash; {masterData.recipes.length} recipes
        </div>
        {Object.entries(grouped).map(([type, recipes]) => (
          <div key={type}>
            <div className="px-3 py-1.5 text-xs font-semibold text-[#6B7280] bg-[#F3F6F9]">{type}</div>
            {recipes.map(recipe => (
              <button
                key={recipe.recipeId}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#F3F6F9] border-b border-[#E5E7EB]
                  ${selectedEntity?.id === recipe.recipeId ? 'bg-[#0066B3] bg-opacity-10 text-[#0066B3]' : 'text-[#303030]'}`}
                onClick={() => selectEntity({ type: 'recipe', id: recipe.recipeId })}
              >
                <div className="font-mono">{recipe.recipeId}</div>
                <div className="text-[10px] text-[#6B7280]">{recipe.currentVersion}</div>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 p-4">
        {!selectedRecipe && (
          <div className="flex items-center justify-center h-full text-xs text-[#9CA3AF] font-mono">
            Select a recipe from the library
          </div>
        )}
        {selectedRecipe && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[#1A1A1A]">
              {selectedRecipe.recipeName} &mdash; <span className="font-mono">{selectedRecipe.currentVersion}</span>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#6B7280] mb-1">Parameters</div>
              <div className="font-mono text-xs">
                {Object.entries(selectedRecipe.parameters).map(([key, value], i) => (
                  <div key={key} className={`flex px-2 py-1 ${i % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                    <span className="w-48 text-[#6B7280]">{key}</span>
                    <span className="text-[#1A1A1A]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedRecipe.versions.length >= 2 && (
              <div>
                <div className="text-xs font-semibold text-[#6B7280] mb-1">Version History (latest change)</div>
                <div className="font-mono text-xs border border-[#D1D5DB]">
                  {selectedRecipe.versions.slice(-2).map((ver, i) => (
                    <div key={ver.version} className={`px-2 py-1.5 ${i === 1 ? 'bg-[#DCFCE7]' : 'bg-[#FEF2F2]'} border-b border-[#E5E7EB]`}>
                      <div className="flex justify-between">
                        <span>{i === 0 ? '\u2212' : '+'} {ver.version}</span>
                        <span className="text-[#6B7280]">{ver.author}</span>
                      </div>
                      <div className="text-[#6B7280] mt-0.5">{ver.changeNote}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-[#6B7280] mb-1">Sign-off Chain</div>
              {selectedRecipe.versions.map(ver => (
                <div key={ver.version} className="flex items-center gap-2 py-1 text-xs border-b border-[#E5E7EB]">
                  <span className="font-mono text-[#0066B3]">{ver.version}</span>
                  <span className="text-[#6B7280]">by</span>
                  <span className="font-mono">{ver.author}</span>
                  <span className="text-[#9CA3AF] ml-auto">{ver.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
