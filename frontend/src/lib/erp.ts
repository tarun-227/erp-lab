// Cheap ERP maths done in the browser so sliders respond instantly (mirrors backend core/erp.py).

import type { Peak } from './types'

export function averageWithCI(trials: number[][]): { mean: number[]; ci: number[] } {
  const n = trials.length
  if (n === 0) return { mean: [], ci: [] }
  const len = trials[0].length
  const mean = new Array<number>(len).fill(0)
  for (const t of trials) for (let i = 0; i < len; i++) mean[i] += t[i] / n
  if (n < 2) return { mean, ci: new Array<number>(len).fill(0) }
  const ci = new Array<number>(len).fill(0)
  for (const t of trials) for (let i = 0; i < len; i++) ci[i] += (t[i] - mean[i]) ** 2
  for (let i = 0; i < len; i++) ci[i] = (1.96 * Math.sqrt(ci[i] / (n - 1))) / Math.sqrt(n)
  return { mean, ci }
}

export function findPeak(times: number[], wave: number[], start: number, end: number, polarity: 'positive' | 'negative'): Peak | null {
  let best: Peak | null = null
  for (let i = 0; i < times.length; i++) {
    if (times[i] < start || times[i] > end) continue
    const v = wave[i]
    if (!best || (polarity === 'positive' ? v > best.amplitude_uv : v < best.amplitude_uv)) {
      best = { latency_s: times[i], amplitude_uv: v }
    }
  }
  return best
}

export function meanInWindow(times: number[], wave: number[], start: number, end: number): number | null {
  let sum = 0
  let count = 0
  times.forEach((t, i) => {
    if (t >= start && t <= end) {
      sum += wave[i]
      count++
    }
  })
  return count ? sum / count : null
}

/** Standardized measurement error of the mean amplitude: SD of single-trial window means over √N (Luck et al., 2021). */
export function smeMeanAmplitude(trials: number[][], times: number[], start: number, end: number): number | null {
  const idx = times.flatMap((t, i) => (t >= start && t <= end ? [i] : []))
  if (trials.length < 2 || !idx.length) return null
  const scores = trials.map((t) => idx.reduce((a, i) => a + t[i], 0) / idx.length)
  const m = scores.reduce((a, b) => a + b, 0) / scores.length
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - m) ** 2, 0) / (scores.length - 1))
  return sd / Math.sqrt(scores.length)
}

/** Time that splits the component's area (its polarity only) in the window in half; more stable than the peak. */
export function areaLatency(times: number[], wave: number[], start: number, end: number, polarity: 'positive' | 'negative', fraction = 0.5): number | null {
  const pts: [number, number][] = []
  times.forEach((t, i) => {
    if (t >= start && t <= end) pts.push([t, Math.max(0, polarity === 'positive' ? wave[i] : -wave[i])])
  })
  const total = pts.reduce((a, [, v]) => a + v, 0)
  if (!pts.length || total <= 0) return null
  let acc = 0
  for (const [t, v] of pts) {
    acc += v
    if (acc >= fraction * total) return t
  }
  return pts[pts.length - 1][0]
}

/** Small deterministic RNG (mulberry32) so the noise curve does not flicker between renders. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample<T>(items: T[], n: number, rand: () => number): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

function std(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length)
}

/**
 * Noise left in a window (usually the baseline) after averaging n random trials, for several n.
 * Returns the measured values and the 1/√n prediction from single trials.
 */
export function noiseCurve(trials: number[][], mask: boolean[], ns: number[], repeats = 12, seed = 7) {
  const rand = rng(seed)
  const pick = (wave: number[]) => wave.filter((_, i) => mask[i])
  const single = trials.length ? trials.map((t) => std(pick(t))).reduce((a, b) => a + b, 0) / trials.length : 0
  const measured = ns.map((n) => {
    let total = 0
    for (let r = 0; r < repeats; r++) total += std(pick(averageWithCI(sample(trials, n, rand)).mean))
    return total / repeats
  })
  return { ns, measured, theory: ns.map((n) => single / Math.sqrt(n)) }
}

/** Powers of two up to max, always ending with max itself. */
export function trialSteps(max: number): number[] {
  const out: number[] = []
  for (let n = 1; n < max; n *= 2) out.push(n)
  if (max > 0) out.push(max)
  return out
}

/** Scalp-map grid: values (one per channel) through the interpolation matrix; null outside the head. */
export function topoGrid(weights: number[][], inside: number[], resolution: number, values: number[]): (number | null)[][] {
  const flat = new Array<number | null>(resolution * resolution).fill(null)
  inside.forEach((g, row) => {
    const w = weights[row]
    let v = 0
    for (let c = 0; c < values.length; c++) v += w[c] * values[c]
    flat[g] = v
  })
  const grid: (number | null)[][] = []
  for (let r = 0; r < resolution; r++) grid.push(flat.slice(r * resolution, (r + 1) * resolution))
  return grid
}

export function nearestIndex(values: number[], target: number): number {
  let best = 0
  for (let i = 1; i < values.length; i++) if (Math.abs(values[i] - target) < Math.abs(values[best] - target)) best = i
  return best
}
