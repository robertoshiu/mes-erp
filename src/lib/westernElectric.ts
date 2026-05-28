export interface ControlPoint {
  value: number
  ucl: number
  lcl: number
  centerline: number
  index: number
}

export interface Violation {
  rule: 1 | 2 | 4
  index: number
  severity: 'info' | 'warn' | 'critical'
  description: string
}

export function checkWesternElectric(points: ControlPoint[]): Violation[] {
  const violations: Violation[] = []

  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Rule 1: Single point beyond 3-sigma (UCL/LCL)
    if (p.value > p.ucl || p.value < p.lcl) {
      violations.push({
        rule: 1,
        index: i,
        severity: 'critical',
        description: `Point ${i} (${p.value.toFixed(2)}) beyond ${p.value > p.ucl ? 'UCL' : 'LCL'}`,
      })
    }

    // Rule 2: 9 consecutive points on same side of centerline
    if (i >= 8) {
      const window = points.slice(i - 8, i + 1)
      const allAbove = window.every(pt => pt.value > pt.centerline)
      const allBelow = window.every(pt => pt.value < pt.centerline)
      if (allAbove || allBelow) {
        violations.push({
          rule: 2,
          index: i,
          severity: 'warn',
          description: `9 consecutive points ${allAbove ? 'above' : 'below'} centerline ending at ${i}`,
        })
      }
    }

    // Rule 4: 14 consecutive points alternating up-down
    if (i >= 13) {
      let alternating = true
      for (let j = i - 12; j <= i; j++) {
        if (j === i - 12) continue // need at least 2 diffs to check alternation
        const prevDiff = points[j].value - points[j - 1].value
        const prevPrevDiff = points[j - 1].value - points[j - 2].value
        if ((prevDiff > 0 && prevPrevDiff > 0) || (prevDiff < 0 && prevPrevDiff < 0) || prevDiff === 0 || prevPrevDiff === 0) {
          alternating = false
          break
        }
      }
      if (alternating) {
        violations.push({
          rule: 4,
          index: i,
          severity: 'info',
          description: `14 consecutive alternating points ending at ${i}`,
        })
      }
    }
  }

  return violations
}
