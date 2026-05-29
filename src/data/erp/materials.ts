import { mulberry32 } from '../prng'
import type { MasterData } from '../master'
import type { Material } from './types'

const MATERIALS_SEED = 500
const PLANT = 'FAB-01'

// Raw material catalog: a base set of fab consumables. Multiple SKUs are spun
// off each base so the total count lands in the 120-160 range.
interface RawTemplate {
  prefix: string          // SKU prefix, e.g. 'WAF'
  description: string
  baseUoM: string
  materialGroup: string
  valuationClass: string
  costLo: number
  costHi: number
  leadLo: number
  leadHi: number
  variants: string[]      // suffix label per generated SKU
}

const RAW_TEMPLATES: RawTemplate[] = [
  {
    prefix: 'WAF', description: 'Silicon Wafer', baseUoM: 'WAF',
    materialGroup: 'SUBSTRATE', valuationClass: '3000',
    costLo: 80, costHi: 140, leadLo: 21, leadHi: 56,
    variants: ['300mm Prime', '300mm Test', '300mm Epi', '200mm Prime', 'SOI 300mm'],
  },
  {
    prefix: 'PR', description: 'Photoresist', baseUoM: 'L',
    materialGroup: 'CHEMICAL', valuationClass: '3010',
    costLo: 400, costHi: 1200, leadLo: 14, leadHi: 35,
    variants: ['EUV CAR', 'ArF Immersion', 'KrF DUV', 'i-line', 'EUV Underlayer', 'BARC'],
  },
  {
    prefix: 'TGT', description: 'Sputter Target', baseUoM: 'EA',
    materialGroup: 'TARGET', valuationClass: '3020',
    costLo: 1500, costHi: 6000, leadLo: 28, leadHi: 70,
    variants: ['Copper Cu', 'Tungsten W', 'Titanium Ti', 'TiN', 'Tantalum Ta', 'Aluminum Al', 'Cobalt Co'],
  },
  {
    prefix: 'GAS', description: 'Process Gas', baseUoM: 'KG',
    materialGroup: 'GAS', valuationClass: '3030',
    costLo: 30, costHi: 300, leadLo: 7, leadHi: 21,
    variants: ['SiH4 Silane', 'NH3 Ammonia', 'CF4', 'C4F8', 'Cl2 Chlorine', 'WF6', 'O2 Oxygen', 'Ar Argon', 'N2 Nitrogen', 'HBr'],
  },
  {
    prefix: 'SLR', description: 'CMP Slurry', baseUoM: 'L',
    materialGroup: 'CHEMICAL', valuationClass: '3010',
    costLo: 60, costHi: 220, leadLo: 14, leadHi: 28,
    variants: ['Oxide Ceria', 'Copper', 'Tungsten', 'STI'],
  },
  {
    prefix: 'CHM', description: 'Wet Chemical', baseUoM: 'L',
    materialGroup: 'CHEMICAL', valuationClass: '3010',
    costLo: 20, costHi: 180, leadLo: 7, leadHi: 21,
    variants: ['HF Buffered', 'SC-1 Clean', 'SC-2 Clean', 'Developer TMAH', 'Phosphoric Acid', 'IPA Solvent'],
  },
  {
    prefix: 'CON', description: 'Consumable', baseUoM: 'EA',
    materialGroup: 'CONSUMABLE', valuationClass: '3040',
    costLo: 50, costHi: 800, leadLo: 14, leadHi: 42,
    variants: ['CMP Pad', 'Edge Coupling Ring', 'Electrostatic Chuck', 'Quartz Boat', 'Showerhead', 'O-Ring Kit', 'Pinchuck'],
  },
]

// Semi-finished (HALB) templates — partially processed wafers between stages.
const HALB_VARIANTS: { suffix: string; group: string }[] = [
  { suffix: 'Patterned Wafer', group: 'WIP-SEMI' },
  { suffix: 'Metallized Wafer', group: 'WIP-SEMI' },
  { suffix: 'Gate Stack Wafer', group: 'WIP-SEMI' },
  { suffix: 'BEOL Subassembly', group: 'WIP-SEMI' },
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Generate the material master:
 *  - FERT: one finished good per MES product (linked via productCode).
 *  - ROH:  silicon wafers, photoresist, targets, gases, slurries, chemicals, consumables.
 *  - HALB: a handful of semi-finished WIP materials.
 * Deterministic via a fixed seed; ~120-160 materials total.
 */
export function generateMaterials(masterData: MasterData): Material[] {
  const rng = mulberry32(MATERIALS_SEED)
  const materials: Material[] = []

  // --- FERT: finished goods, one per product ---
  for (const product of masterData.products) {
    materials.push({
      materialNo: `FG-${product.productCode}`,
      type: 'FERT',
      description: `${product.productName} (${product.technology})`,
      baseUoM: 'WAF',
      materialGroup: 'FINISHED-DIE',
      plant: PLANT,
      valuationClass: '7920',
      standardCost: round2(2000 + rng() * 6000),
      leadTimeDays: 35 + Math.floor(rng() * 50),
      productCode: product.productCode,
    })
  }

  // --- ROH: raw materials ---
  // Each variant is spun into 2 grade/spec SKUs so the catalog reaches the
  // 120-160 target while staying realistic (vendors stock multiple grades).
  const GRADES = ['Grade A', 'Grade B', 'Grade C']
  let rawCounter = 0
  for (const tpl of RAW_TEMPLATES) {
    for (let v = 0; v < tpl.variants.length; v++) {
      for (let g = 0; g < GRADES.length; g++) {
        rawCounter++
        const materialNo = `${tpl.prefix}-${String(rawCounter).padStart(4, '0')}`
        materials.push({
          materialNo,
          type: 'ROH',
          description: `${tpl.description} - ${tpl.variants[v]} (${GRADES[g]})`,
          baseUoM: tpl.baseUoM,
          materialGroup: tpl.materialGroup,
          plant: PLANT,
          valuationClass: tpl.valuationClass,
          standardCost: round2(tpl.costLo + rng() * (tpl.costHi - tpl.costLo)),
          leadTimeDays: tpl.leadLo + Math.floor(rng() * (tpl.leadHi - tpl.leadLo + 1)),
        })
      }
    }
  }

  // --- HALB: semi-finished WIP ---
  for (let i = 0; i < HALB_VARIANTS.length; i++) {
    const hv = HALB_VARIANTS[i]
    materials.push({
      materialNo: `SF-${String(i + 1).padStart(3, '0')}`,
      type: 'HALB',
      description: hv.suffix,
      baseUoM: 'WAF',
      materialGroup: hv.group,
      plant: PLANT,
      valuationClass: '7900',
      standardCost: round2(800 + rng() * 2500),
      leadTimeDays: 7 + Math.floor(rng() * 14),
    })
  }

  return materials
}
