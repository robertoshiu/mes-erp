import { describe, it, expect } from 'vitest'
import { foldAlarmsBySeverity, windowTotal, type AlarmSeverity } from './severityFold'

function alarm(t: number, severity: AlarmSeverity) {
  return { t, severity }
}

describe('foldAlarmsBySeverity', () => {
  it('produces the requested number of buckets', () => {
    const out = foldAlarmsBySeverity([], 100, 100, 10)
    expect(out).toHaveLength(10)
  })

  it('bins alarms into the right time slice by severity', () => {
    // window [0,100], 10 buckets of 10s each.
    const out = foldAlarmsBySeverity(
      [alarm(5, 'critical'), alarm(15, 'major'), alarm(15, 'minor')],
      100,
      100,
      10,
    )
    expect(out[0].critical).toBe(1)
    expect(out[1].major).toBe(1)
    expect(out[1].minor).toBe(1)
  })

  it('drops alarms outside the window', () => {
    const out = foldAlarmsBySeverity([alarm(-5, 'critical'), alarm(200, 'major')], 100, 100, 10)
    expect(windowTotal(out)).toBe(0)
  })

  it('counts an alarm exactly at `now` in the last bucket', () => {
    const out = foldAlarmsBySeverity([alarm(100, 'critical')], 100, 100, 10)
    expect(out[9].critical).toBe(1)
  })

  it('is deterministic for identical inputs', () => {
    const args = [[alarm(42, 'major')], 100, 100, 8] as const
    expect(foldAlarmsBySeverity(...args)).toEqual(foldAlarmsBySeverity(...args))
  })
})

describe('windowTotal', () => {
  it('sums every severity across buckets', () => {
    const out = foldAlarmsBySeverity(
      [alarm(10, 'critical'), alarm(20, 'major'), alarm(30, 'minor')],
      100,
      100,
      10,
    )
    expect(windowTotal(out)).toBe(3)
  })
})
