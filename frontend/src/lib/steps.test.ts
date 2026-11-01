import { describe, expect, it } from 'vitest'
import { canVisit, formatDuration, stepForKey } from './steps'

describe('step navigation', () => {
  it('only allows Load before data is loaded', () => {
    expect(canVisit('load', false)).toBe(true)
    expect(canVisit('erp', false)).toBe(false)
    expect(canVisit('erp', true)).toBe(true)
  })

  it('maps number keys to steps', () => {
    expect(stepForKey('1')).toBe('load')
    expect(stepForKey('4')).toBe('erp')
    expect(stepForKey('7')).toBeNull()
    expect(stepForKey('a')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatDuration(42.4)).toBe('42 s')
    expect(formatDuration(245)).toBe('4 min 05 s')
  })
})
