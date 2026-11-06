import { describe, expect, it } from 'vitest'
import { BASE_PARAMS, defaultParams, lowPassOptions, paramsProblem } from './presets'
import type { LoadResponse, ProcessParams } from './types'

const upload = (sfreq: number): LoadResponse => ({
  session_id: 's',
  source: 'upload',
  summary: { n_channels: 2, ch_names: ['Cz', 'Pz'], sfreq, duration_s: 60, n_events: 10, event_counts: { '1': 6, '2': 4 } },
  suggested_event_names: {},
  description: '',
  has_positions: true,
})

describe('filters that fit the recording', () => {
  it('offers only low-pass cut-offs below Nyquist', () => {
    expect(lowPassOptions(250)).toEqual([5, 10, 15, 20, 30, 40, 60, 100, 0])
    expect(lowPassOptions(160)).toEqual([5, 10, 15, 20, 30, 40, 60, 0])
    expect(lowPassOptions(64)).toEqual([5, 10, 15, 20, 30, 0])
  })

  it('lowers the default low-pass for slow recordings', () => {
    expect(defaultParams(upload(250)).h_freq).toBe(30)
    expect(defaultParams(upload(50)).h_freq).toBe(20)
    expect(defaultParams(upload(8)).h_freq).toBe(0)
  })

  it('flags a low-pass above Nyquist before calling the server', () => {
    const p: ProcessParams = { ...BASE_PARAMS, conditions: [{ code: 1, name: 'a' }], h_freq: 100 }
    expect(paramsProblem(p, 250)).toBeNull()
    expect(paramsProblem(p, 160)).toMatch(/half the sampling rate \(80 Hz\)/)
    expect(paramsProblem(p)).toBeNull()
  })
})
