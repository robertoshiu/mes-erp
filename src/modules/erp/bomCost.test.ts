import { describe, it, expect } from 'vitest'
import { rollupBomCost, indexBomsByHeader } from './bomCost'
import type { Bom, Material } from '../../data/erp/types'

function mat(materialNo: string, standardCost: number, type: Material['type'] = 'ROH'): Material {
  return {
    materialNo,
    type,
    description: materialNo,
    baseUoM: 'EA',
    materialGroup: 'G1',
    plant: '1000',
    valuationClass: '3000',
    standardCost,
    leadTimeDays: 3,
  }
}

function bom(headerMaterialNo: string, components: Bom['components']): Bom {
  return { bomId: `BOM-${headerMaterialNo}`, headerMaterialNo, headerDescription: headerMaterialNo, components }
}

describe('rollupBomCost', () => {
  it('sums standardCost × qty for purchased components', () => {
    const matByNo = new Map([['R1', mat('R1', 10)], ['R2', mat('R2', 5)]])
    const b = bom('FG', [
      { materialNo: 'R1', description: 'R1', qty: 3, uom: 'EA' },
      { materialNo: 'R2', description: 'R2', qty: 4, uom: 'EA' },
    ])
    const result = rollupBomCost(b, new Map(), matByNo)
    expect(result.total).toBe(3 * 10 + 4 * 5) // 50
    expect(result.components[0].extended).toBe(30)
    expect(result.components[1].extended).toBe(20)
  })

  it('recurses into sub-assemblies for a multi-level roll-up', () => {
    const matByNo = new Map([
      ['FG', mat('FG', 0, 'FERT')],
      ['SUB', mat('SUB', 0, 'HALB')],
      ['R1', mat('R1', 7)],
      ['R2', mat('R2', 2)],
    ])
    const subBom = bom('SUB', [{ materialNo: 'R2', description: 'R2', qty: 5, uom: 'EA' }]) // cost = 10
    const fgBom = bom('FG', [
      { materialNo: 'SUB', description: 'SUB', qty: 2, uom: 'EA' }, // 2 × 10 = 20
      { materialNo: 'R1', description: 'R1', qty: 1, uom: 'EA' }, // 1 × 7 = 7
    ])
    const byHeader = indexBomsByHeader([fgBom, subBom])
    const result = rollupBomCost(fgBom, byHeader, matByNo)
    expect(result.total).toBe(27)
    expect(result.components[0].unitCost).toBe(10) // SUB rolled up
    expect(result.components[0].extended).toBe(20)
  })

  it('falls back to standardCost when a component has no BOM', () => {
    const matByNo = new Map([['X', mat('X', 42)]])
    const b = bom('FG', [{ materialNo: 'X', description: 'X', qty: 2, uom: 'EA' }])
    const result = rollupBomCost(b, new Map(), matByNo)
    expect(result.components[0].unitCost).toBe(42)
    expect(result.total).toBe(84)
  })

  it('treats unknown components as zero cost', () => {
    const b = bom('FG', [{ materialNo: 'GHOST', description: 'GHOST', qty: 9, uom: 'EA' }])
    const result = rollupBomCost(b, new Map(), new Map())
    expect(result.total).toBe(0)
  })

  it('guards against circular BOMs without infinite recursion', () => {
    const matByNo = new Map([['A', mat('A', 3)], ['B', mat('B', 4)]])
    const bomA = bom('A', [{ materialNo: 'B', description: 'B', qty: 1, uom: 'EA' }])
    const bomB = bom('B', [{ materialNo: 'A', description: 'A', qty: 1, uom: 'EA' }])
    const byHeader = indexBomsByHeader([bomA, bomB])
    // Should terminate. A→B→(A cycle-guarded → std cost 3) so B=3, A=3.
    const result = rollupBomCost(bomA, byHeader, matByNo)
    expect(Number.isFinite(result.total)).toBe(true)
    expect(result.total).toBe(3)
  })
})

describe('indexBomsByHeader', () => {
  it('indexes by header material, first definition wins', () => {
    const b1 = bom('FG', [])
    const b2 = bom('FG', [{ materialNo: 'R', description: 'R', qty: 1, uom: 'EA' }])
    const idx = indexBomsByHeader([b1, b2])
    expect(idx.get('FG')).toBe(b1)
  })
})
