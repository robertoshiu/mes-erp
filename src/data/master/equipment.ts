import { mulberry32, pick } from '../prng'
import type { E10State } from '../../lib/events'

export interface Equipment {
  toolId: string
  toolName: string
  bay: string
  bayIndex: number
  slotInBay: number
  toolType: string
  vendor: string
  model: string
  initialState: E10State
  x: number
  y: number
}

const BAYS = ['BAY-01', 'BAY-02', 'BAY-03', 'BAY-04', 'BAY-05', 'BAY-06', 'BAY-07', 'BAY-08']
const TOOL_TYPES = ['LITHO', 'ETCH', 'CMP', 'CVD', 'PVD', 'DIFF', 'IMPL', 'INSP']
const VENDORS = ['ASML', 'LAM', 'AMAT', 'TEL', 'KLA', 'SCREEN']
const MODELS: Record<string, string[]> = {
  LITHO: ['NXT:2000i', 'NXT:1980Di', 'TWINSCAN 1970Ci'],
  ETCH: ['Kiyo FX', 'Versys 2300', 'Exelan HPT'],
  CMP: ['Reflexion LK', 'FREX 300S', 'Mirra Mesa'],
  CVD: ['Producer SE', 'TELINDY Plus', 'iSpeed'],
  PVD: ['Endura Clover', 'Inova XT', 'ENTRON EX'],
  DIFF: ['ADVANCE 400', 'ALPHA 303iH', 'VF-3000'],
  IMPL: ['VIISta 900XP', 'Purion H', 'MC3 Ultra'],
  INSP: ['Puma 9975Bi', 'INS-3300', 'Surfscan SP7'],
}

export function generateEquipment(seed = 42): Equipment[] {
  const rng = mulberry32(seed)
  const equipment: Equipment[] = []

  // 8 bays, ~6 tools each = ~48 tools
  const toolsPerBay = [7, 6, 6, 6, 7, 6, 6, 6] // = 50

  for (let bayIdx = 0; bayIdx < BAYS.length; bayIdx++) {
    const bay = BAYS[bayIdx]
    const toolType = TOOL_TYPES[bayIdx]
    const vendor = pick(VENDORS, rng)
    const models = MODELS[toolType]

    for (let slot = 0; slot < toolsPerBay[bayIdx]; slot++) {
      const toolNum = String(slot + 1).padStart(2, '0')
      const toolId = `EQP-${toolType}-${toolNum}`

      // Deterministic initial E10 state distribution
      // ~70% PROD, ~15% STBY, ~5% SDT, ~5% ENG, ~5% other
      const r = rng()
      let initialState: E10State = 'PROD'
      if (r > 0.95) initialState = 'NSC'
      else if (r > 0.90) initialState = 'ENG'
      else if (r > 0.85) initialState = 'SDT'
      else if (r > 0.70) initialState = 'STBY'

      equipment.push({
        toolId,
        toolName: `${toolType}-${toolNum} ${pick(models, rng)}`,
        bay,
        bayIndex: bayIdx,
        slotInBay: slot,
        toolType,
        vendor,
        model: pick(models, rng),
        initialState,
        // Grid layout: bays in 2 rows of 4, tools in columns within bay
        x: (bayIdx % 4) * 250 + slot * 35 + 20,
        y: Math.floor(bayIdx / 4) * 300 + 60,
      })
    }
  }

  return equipment
}
