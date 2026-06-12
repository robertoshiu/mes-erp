// Deterministic per-recipe "loads" usage for the usage RankBar. The Recipe screen
// receives only masterData (its App.tsx call site is owned by another wave and is
// read-only here), so there is no live recipe.load stream to fold. We synthesize a
// stable load count hash-seeded off recipeId (cyrb53 idiom, mirroring SalesOrders'
// ATP) — identical across reloads, no PRNG-in-render, no wall clock. Pure +
// framework-free so it unit-tests under the node env.
import { cyrb53 } from '../../data/prng'

export interface RecipeUsage {
  recipeId: string
  recipeName: string
  loads: number
}

/** Deterministic load count (12..160) for a recipe, biased up for lower version
 *  ordinals so mature recipes read as heavily used. */
export function recipeLoads(recipeId: string, versionCount: number): number {
  const base = 12 + (cyrb53(recipeId, 0x10AD) % 120)
  // Each shipped version adds a little baked-in usage (mature recipes run more).
  return base + Math.max(0, versionCount - 1) * 6
}

/** Rank recipes by synthetic load count (descending). Stable + pure. */
export function rankRecipesByUsage(
  recipes: readonly { recipeId: string; recipeName: string; versions: unknown[] }[],
): RecipeUsage[] {
  return recipes
    .map(r => ({
      recipeId: r.recipeId,
      recipeName: r.recipeName,
      loads: recipeLoads(r.recipeId, r.versions.length),
    }))
    .sort((a, b) => b.loads - a.loads)
}
