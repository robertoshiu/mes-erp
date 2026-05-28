import { mulberry32, pick } from '../prng'

export interface Operator {
  operatorId: string
  name: string
  nameZh: string
  shift: 'A' | 'B' | 'C'
  role: 'operator' | 'engineer' | 'supervisor'
  certifiedTools: string[]
}

// Mix of EN + zh-TW names per design doc i18n decision
const SURNAMES_ZH = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊']
const GIVEN_ZH = ['志明', '淑芬', '建宏', '美玲', '家豪', '雅婷', '俊傑', '怡君', '宗翰', '佩君']
const SURNAMES_EN = ['Chen', 'Lin', 'Huang', 'Chang', 'Lee', 'Wang', 'Wu', 'Liu', 'Tsai', 'Yang']
const GIVEN_EN = ['James', 'Sarah', 'Kevin', 'Grace', 'Alex', 'Amy', 'Brian', 'Iris', 'David', 'Peggy']
const SHIFTS: ('A' | 'B' | 'C')[] = ['A', 'B', 'C']
const ROLES: ('operator' | 'engineer' | 'supervisor')[] = ['operator', 'operator', 'operator', 'engineer', 'supervisor']

export function generateOperators(seed = 200, toolIds: string[] = []): Operator[] {
  const rng = mulberry32(seed)
  const operators: Operator[] = []

  for (let i = 0; i < 80; i++) {
    const sIdx = i % SURNAMES_ZH.length
    const gIdx = Math.floor(rng() * GIVEN_ZH.length)
    const shift = SHIFTS[i % 3]
    const role = pick(ROLES, rng)
    const numCerts = role === 'engineer' ? 8 : role === 'supervisor' ? 12 : 4
    const certs: string[] = []
    for (let c = 0; c < numCerts && c < toolIds.length; c++) {
      const idx = Math.floor(rng() * toolIds.length)
      if (!certs.includes(toolIds[idx])) certs.push(toolIds[idx])
    }

    operators.push({
      operatorId: `OP-${String(i + 1).padStart(3, '0')}`,
      name: `${SURNAMES_EN[sIdx]} ${GIVEN_EN[gIdx]}`,
      nameZh: `${SURNAMES_ZH[sIdx]}${GIVEN_ZH[gIdx]}`,
      shift,
      role,
      certifiedTools: certs,
    })
  }

  return operators
}
