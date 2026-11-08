import type { Condition, LoadResponse, ProcessParams } from './types'

export const BASE_PARAMS: Omit<ProcessParams, 'conditions'> = {
  l_freq: 0.1,
  h_freq: 30,
  reference: 'average',
  tmin: -0.2,
  tmax: 0.8,
  baseline: true,
  baseline_start: -0.2,
  baseline_end: 0,
  reject_uv: 100,
  channel: 'Pz',
  peak_start: 0.25,
  peak_end: 0.5,
  polarity: 'positive',
}

export const HIGH_PASS = [0, 0.1, 0.3, 0.5, 1, 2, 5]
export const LOW_PASS = [5, 10, 15, 20, 30, 40, 60, 100, 0]

/** Low-pass choices this recording allows: a cut-off must be below half the sampling rate (0 = off). */
export function lowPassOptions(sfreq: number): number[] {
  return LOW_PASS.filter((f) => f === 0 || f < sfreq / 2)
}

export interface Preset {
  id: string
  label: string
  description: string
  /** Event names (as suggested by the data) to use as conditions, in order. */
  conditions: string[]
  params: Partial<ProcessParams>
}

const PRESETS: Preset[] = [
  {
    id: 'ern',
    label: 'ERN (errors vs correct)',
    description: 'Response-locked error-related negativity at FCz, 0–100 ms after the button press.',
    conditions: ['response/correct', 'response/error'],
    params: {
      channel: 'FCz', peak_start: 0, peak_end: 0.1, polarity: 'negative',
      tmin: -0.6, tmax: 0.6, baseline_start: -0.4, baseline_end: -0.2, reject_uv: 150,
    },
  },
  {
    id: 'flanker-p3',
    label: 'Flanker P3',
    description: 'Stimulus-locked P3 at Pz for compatible vs incompatible flankers, 300–600 ms.',
    conditions: ['stimulus/compatible', 'stimulus/incompatible'],
    params: {
      channel: 'Pz', peak_start: 0.3, peak_end: 0.6, polarity: 'positive',
      tmin: -0.2, tmax: 0.8, baseline_start: -0.2, baseline_end: 0, reject_uv: 150,
    },
  },
  {
    id: 'oddball-p300',
    label: 'Oddball P300',
    description: 'Stimulus-locked P300 at CPz for rare target tones vs frequent tones, 250–600 ms.',
    conditions: ['tone/standard', 'tone/oddball'],
    params: {
      channel: 'CPz', peak_start: 0.25, peak_end: 0.6, polarity: 'positive',
      tmin: -0.2, tmax: 0.8, baseline_start: -0.2, baseline_end: 0, reject_uv: 150,
    },
  },
  {
    id: 'oddball-noise',
    label: 'Noise bursts',
    description: 'An earlier, more central response at Cz to surprising noise vs frequent tones, 200–450 ms.',
    conditions: ['tone/standard', 'sound/noise'],
    params: {
      channel: 'Cz', peak_start: 0.2, peak_end: 0.45, polarity: 'positive',
      tmin: -0.2, tmax: 0.8, baseline_start: -0.2, baseline_end: 0, reject_uv: 150,
    },
  },
  {
    id: 'ssvep',
    label: '12 Hz vs 15 Hz flicker',
    description: 'Steady-state response at O2: the average keeps following the flicker. 1–40 Hz filter, so the rhythm stands out.',
    conditions: ['flicker/12 Hz', 'flicker/15 Hz'],
    params: {
      channel: 'O2', l_freq: 1, h_freq: 40, peak_start: 0, peak_end: 0.8, polarity: 'positive',
      tmin: -0.2, tmax: 0.8, baseline_start: -0.2, baseline_end: 0, reject_uv: 150,
    },
  },
]

export function presetsFor(dataset: LoadResponse): Preset[] {
  // A preset appears whenever the recording has its event names (a bundled sample, or an upload of it).
  const available = new Set(Object.values(dataset.suggested_event_names))
  return PRESETS.filter((p) => p.conditions.every((c) => available.has(c)))
}

export function conditionsByName(dataset: LoadResponse, names: string[]): Condition[] {
  const byName = Object.fromEntries(Object.entries(dataset.suggested_event_names).map(([code, name]) => [name, Number(code)]))
  return names.filter((n) => n in byName).map((name) => ({ code: byName[name], name }))
}

/** Clamp a channel choice to one the recording has. */
export function pickChannel(dataset: LoadResponse, wanted: string): string {
  const chs = dataset.summary.ch_names
  return chs.find((c) => c.toLowerCase() === wanted.toLowerCase()) ?? chs.find((c) => ['Pz', 'Cz', 'Fz'].includes(c)) ?? chs[0]
}

export function applyPreset(dataset: LoadResponse, preset: Preset, current?: ProcessParams): ProcessParams {
  const base = current ?? { ...BASE_PARAMS, conditions: [] }
  const params = { ...base, ...preset.params, conditions: conditionsByName(dataset, preset.conditions) }
  return fitFilters({ ...params, channel: pickChannel(dataset, params.channel) }, dataset.summary.sfreq)
}

export function defaultParams(dataset: LoadResponse): ProcessParams {
  const preset = presetsFor(dataset)[0]
  if (preset) return applyPreset(dataset, preset)
  // Other uploads: the two most frequent event codes, a central channel, a generic window.
  const codes = Object.entries(dataset.summary.event_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code]) => ({ code: Number(code), name: dataset.suggested_event_names[code] ?? `Code ${code}` }))
  return fitFilters({ ...BASE_PARAMS, conditions: codes, channel: pickChannel(dataset, 'Cz') }, dataset.summary.sfreq)
}

/** Lower the low-pass to the highest choice below Nyquist when a slow recording cannot take it. */
export function fitFilters(p: ProcessParams, sfreq: number): ProcessParams {
  if (!p.h_freq || p.h_freq < sfreq / 2) return p
  const below = lowPassOptions(sfreq).filter((f) => f > 0)
  return { ...p, h_freq: below.length ? below[below.length - 1] : 0 }
}

/** Client-side check of the rules the backend enforces, so we never send a request that must fail. */
export function paramsProblem(p: ProcessParams, sfreq?: number): string | null {
  const names = p.conditions.map((c) => c.name.trim())
  if (!p.conditions.length) return 'Pick at least one condition in the Events step.'
  if (names.some((n) => !n) || new Set(names).size !== names.length) return 'Condition names must be unique and not empty.'
  if (p.baseline && !(p.tmin <= p.baseline_start && p.baseline_start < p.baseline_end && p.baseline_end <= p.tmax))
    return 'The baseline window must lie inside the epoch window.'
  if (p.l_freq && p.h_freq && p.l_freq >= p.h_freq) return 'The high-pass cut-off must be below the low-pass cut-off.'
  if (sfreq && p.h_freq && p.h_freq >= sfreq / 2)
    return `The low-pass cut-off must be below half the sampling rate (${sfreq / 2} Hz).`
  if (p.peak_start >= p.peak_end) return 'The peak window must have positive length.'
  return null
}
