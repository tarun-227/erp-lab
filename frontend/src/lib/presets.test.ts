import { describe, expect, it } from 'vitest'
import { BASE_PARAMS, defaultParams, lowPassOptions, paramsProblem, presetsFor } from './presets'
import type { LoadResponse, ProcessParams } from './types'

const upload = (sfreq: number): LoadResponse => ({
  session_id: 's',
  source: 'upload',
  summary: { n_channels: 2, ch_names: ['Cz', 'Pz'], sfreq, duration_s: 60, n_events: 10, event_counts: { '1': 6, '2': 4 } },
  suggested_event_names: {},
  description: '',
  has_positions: true,
})

describe('each sample opens with settings that show its effect', () => {
  const sample = (names: string[], chs: string[]): LoadResponse => ({
    ...upload(250),
    source: 'sample',
    summary: { ...upload(250).summary, ch_names: chs },
    suggested_event_names: Object.fromEntries(names.map((n, i) => [String(i + 1), n])),
  })

  it('oddball: target vs standard tones at CPz', () => {
    const p = defaultParams(sample(['response/keypress', 'sound/noise', 'tone/oddball', 'tone/standard'], ['Cz', 'CPz']))
    expect(p.conditions.map((c) => c.name)).toEqual(['tone/standard', 'tone/oddball'])
    expect(p.channel).toBe('CPz')
    expect(p.polarity).toBe('positive')
  })

  it('SSVEP: 12 vs 15 Hz at O2, with a filter that keeps both rhythms', () => {
    const p = defaultParams(sample(['flicker/12 Hz', 'flicker/15 Hz'], ['Cz', 'O2']))
    expect(p.conditions.map((c) => c.name)).toEqual(['flicker/12 Hz', 'flicker/15 Hz'])
    expect(p.channel).toBe('O2')
    expect(p.h_freq).toBeGreaterThan(15)
  })

  it('offers only the presets a recording has events for', () => {
    expect(presetsFor(sample(['flicker/12 Hz', 'flicker/15 Hz'], ['O2'])).map((x) => x.id)).toEqual(['ssvep'])
    expect(presetsFor(sample(['response/keypress', 'sound/noise', 'tone/oddball', 'tone/standard'], ['Cz'])).map((x) => x.id)).toEqual(['oddball-p300', 'oddball-noise'])
  })
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
