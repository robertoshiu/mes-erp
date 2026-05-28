import { mulberry32, pick } from '../prng'

export interface RecipeVersion {
  version: string
  author: string
  changeNote: string
  timestamp: string
}

export interface Recipe {
  recipeId: string
  recipeName: string
  toolType: string
  currentVersion: string
  versions: RecipeVersion[]
  parameters: Record<string, string>
}

const CHANGE_NOTES = [
  'Optimized gas flow ratio for improved uniformity',
  'Reduced chamber pressure per SPC feedback',
  'Updated endpoint detection algorithm',
  'Adjusted RF power for target CD',
  'Revised thermal ramp profile',
  'Corrected dose map for edge die',
  'Tightened overlay budget per spec rev',
  'Modified CMP slurry flow rate',
]

export function generateRecipes(seed = 300): Recipe[] {
  const rng = mulberry32(seed)
  const recipes: Recipe[] = []
  const TOOL_TYPES = ['LITHO', 'ETCH', 'CMP', 'CVD', 'PVD', 'DIFF', 'IMPL', 'INSP']

  for (let i = 0; i < 30; i++) {
    const toolType = TOOL_TYPES[i % 8]
    const recipeNum = String(Math.floor(i / 8) + 1).padStart(2, '0')
    const recipeId = `RCP-${toolType}-${recipeNum}`
    const major = Math.floor(rng() * 3) + 1
    const minor = Math.floor(rng() * 5)
    const patch = Math.floor(rng() * 10)

    const versions: RecipeVersion[] = []
    for (let v = 0; v <= minor; v++) {
      versions.push({
        version: `v${major}.${v}.${Math.floor(rng() * 10)}`,
        author: `OP-${String(Math.floor(rng() * 20) + 1).padStart(3, '0')}`,
        changeNote: pick(CHANGE_NOTES, rng),
        timestamp: `2026-05-${String(Math.floor(rng() * 28) + 1).padStart(2, '0')}T${String(Math.floor(rng() * 24)).padStart(2, '0')}:00:00`,
      })
    }

    recipes.push({
      recipeId,
      recipeName: `${toolType}_PROC_${recipeNum}`,
      toolType,
      currentVersion: `v${major}.${minor}.${patch}`,
      versions,
      parameters: generateRecipeParams(toolType, rng),
    })
  }

  return recipes
}

function generateRecipeParams(toolType: string, rng: () => number): Record<string, string> {
  const params: Record<string, string> = {}
  switch (toolType) {
    case 'LITHO':
      params['Exposure Dose (mJ/cm2)'] = (20 + rng() * 30).toFixed(1)
      params['Focus Offset (nm)'] = (rng() * 100 - 50).toFixed(0)
      params['Alignment Mode'] = rng() > 0.5 ? 'ATHENA' : 'SMASH'
      break
    case 'ETCH':
      params['RF Power (W)'] = String(Math.floor(200 + rng() * 800))
      params['Chamber Pressure (mTorr)'] = String(Math.floor(5 + rng() * 50))
      params['Gas Flow CF4 (sccm)'] = String(Math.floor(10 + rng() * 90))
      break
    case 'CMP':
      params['Platen Speed (rpm)'] = String(Math.floor(60 + rng() * 60))
      params['Down Force (psi)'] = (2 + rng() * 4).toFixed(1)
      params['Slurry Flow (ml/min)'] = String(Math.floor(150 + rng() * 200))
      break
    default:
      params['Temperature (C)'] = String(Math.floor(200 + rng() * 800))
      params['Time (sec)'] = String(Math.floor(30 + rng() * 300))
      params['Pressure (Torr)'] = (rng() * 10).toFixed(2)
  }
  return params
}
