import { describe, expect, it } from 'vitest'
import { baselineLabel, filterLabel, referenceLabel } from './describe'

describe('processing descriptions', () => {
  it('names the reference, filter and baseline in words', () => {
    expect(referenceLabel('average')).toBe('average reference')
    expect(referenceLabel('Cz')).toBe('Cz reference')
    expect(filterLabel({ l_freq: 0.1, h_freq: 30 })).toBe('band-pass 0.1–30 Hz')
    expect(filterLabel({ l_freq: 0, h_freq: 30 })).toBe('low-pass 30 Hz')
    expect(filterLabel({ l_freq: 0, h_freq: 0 })).toBe('no filter')
    expect(baselineLabel({ baseline: true, baseline_start: -0.4, baseline_end: -0.2 })).toBe('baseline -400 to -200 ms')
    expect(baselineLabel({ baseline: false, baseline_start: 0, baseline_end: 0 })).toBe('no baseline correction')
  })
})
