import { describe, it, expect } from 'vitest'
import { recipeLoads, rankRecipesByUsage } from './usage'

describe('recipeLoads', () => {
  it('is deterministic for the same recipe + version count', () => {
    expect(recipeLoads('RCP-LITHO-01', 3)).toBe(recipeLoads('RCP-LITHO-01', 3))
  })

  it('grows with version count (mature recipes run more)', () => {
    expect(recipeLoads('RCP-ETCH-02', 5)).toBeGreaterThan(recipeLoads('RCP-ETCH-02', 1))
  })

  it('stays within a sane band', () => {
    for (const id of ['RCP-LITHO-01', 'RCP-CMP-02', 'RCP-PVD-03']) {
      const loads = recipeLoads(id, 1)
      expect(loads).toBeGreaterThanOrEqual(12)
      expect(loads).toBeLessThanOrEqual(131)
    }
  })

  it('differs across recipe ids', () => {
    expect(recipeLoads('RCP-LITHO-01', 1)).not.toBe(recipeLoads('RCP-LITHO-02', 1))
  })
})

describe('rankRecipesByUsage', () => {
  it('sorts recipes by loads descending', () => {
    const ranked = rankRecipesByUsage([
      { recipeId: 'A', recipeName: 'A', versions: [1] },
      { recipeId: 'B', recipeName: 'B', versions: [1, 2, 3] },
      { recipeId: 'C', recipeName: 'C', versions: [1, 2] },
    ])
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].loads).toBeGreaterThanOrEqual(ranked[i].loads)
    }
  })
})
