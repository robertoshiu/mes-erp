import { describe, it, expect } from 'vitest'
import { autoTone, toneColor, resolveToneColor } from './vizTone'
import { sem, brand } from './tokens'

describe('autoTone', () => {
  it('maps high ratios to success (≥0.66)', () => {
    expect(autoTone(0.66)).toBe('success')
    expect(autoTone(0.9)).toBe('success')
    expect(autoTone(1)).toBe('success')
  })

  it('maps mid ratios to warn (≥0.33, <0.66)', () => {
    expect(autoTone(0.33)).toBe('warn')
    expect(autoTone(0.5)).toBe('warn')
    expect(autoTone(0.659)).toBe('warn')
  })

  it('maps low ratios to critical (<0.33)', () => {
    expect(autoTone(0)).toBe('critical')
    expect(autoTone(0.329)).toBe('critical')
  })

  it('falls back to critical for non-finite ratios', () => {
    expect(autoTone(NaN)).toBe('critical')
    expect(autoTone(Infinity)).toBe('critical')
  })
})

describe('toneColor', () => {
  it('resolves each tone to its palette hex', () => {
    expect(toneColor('success')).toBe(sem.success)
    expect(toneColor('warn')).toBe(sem.warn)
    expect(toneColor('critical')).toBe(sem.critical)
    expect(toneColor('accent')).toBe(brand.primary)
  })
})

describe('resolveToneColor', () => {
  it('derives the color from the ratio when tone is auto', () => {
    expect(resolveToneColor('auto', 0.8)).toBe(sem.success)
    expect(resolveToneColor('auto', 0.4)).toBe(sem.warn)
    expect(resolveToneColor('auto', 0.1)).toBe(sem.critical)
  })

  it('ignores the ratio for an explicit tone', () => {
    expect(resolveToneColor('accent', 0.1)).toBe(brand.primary)
    expect(resolveToneColor('success', 0)).toBe(sem.success)
  })
})
