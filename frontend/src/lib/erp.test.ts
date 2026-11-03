import { describe, expect, it } from 'vitest'
import { areaLatency, averageWithCI, findPeak, noiseCurve, rng, smeMeanAmplitude, topoGrid, trialSteps } from './erp'

function gaussianTrials(n: number, len: number, sd: number, seed: number): number[][] {
  const rand = rng(seed)
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand())
  return Array.from({ length: n }, () => Array.from({ length: len }, () => sd * normal()))
}

describe('averageWithCI', () => {
  it('matches the NumPy reference (mean and 1.96 × SEM)', () => {
    // numpy: mean=[2,3], std(ddof=1)=[1,1] -> ci = 1.96/sqrt(3)
    const { mean, ci } = averageWithCI([[1, 2], [2, 3], [3, 4]])
    expect(mean).toEqual([2, 3])
    expect(ci[0]).toBeCloseTo(1.96 / Math.sqrt(3), 10)
  })

  it('returns zero width for a single trial', () => {
    expect(averageWithCI([[5, 6]]).ci).toEqual([0, 0])
  })
})

describe('findPeak', () => {
  it('finds the largest point of the right polarity inside the window', () => {
    const times = [0, 0.1, 0.2, 0.3]
    const wave = [5, -2, 3, -4]
    expect(findPeak(times, wave, 0.05, 0.25, 'positive')).toEqual({ latency_s: 0.2, amplitude_uv: 3 })
    expect(findPeak(times, wave, 0.05, 0.35, 'negative')).toEqual({ latency_s: 0.3, amplitude_uv: -4 })
    expect(findPeak(times, wave, 1, 2, 'positive')).toBeNull()
  })
})

describe('noiseCurve', () => {
  it('follows 1/√N for independent noise', () => {
    const trials = gaussianTrials(256, 60, 10, 3)
    const { measured, theory } = noiseCurve(trials, new Array(60).fill(true), [1, 16, 64])
    measured.forEach((m, i) => expect(Math.abs(m - theory[i]) / theory[i]).toBeLessThan(0.2))
    expect(measured[0] / measured[2]).toBeGreaterThan(6)
  })

  it('builds doubling steps that end at the maximum', () => {
    expect(trialSteps(20)).toEqual([1, 2, 4, 8, 16, 20])
  })
})

describe('topoGrid', () => {
  it('multiplies the weights by the channel values and leaves outside points empty', () => {
    const grid = topoGrid([[1, 0], [0.5, 0.5]], [0, 3], 2, [2, 4])
    expect(grid).toEqual([[2, null], [null, 3]])
  })
})

describe('SME and area latency', () => {
  it('SME is the SD of single-trial window means over √N (matches the backend test)', () => {
    const times = Array.from({ length: 11 }, (_, i) => i / 10)
    const trials = [1, 3, 5, 7].map((v) => times.map(() => v))
    const sd = Math.sqrt(((1 - 4) ** 2 + (3 - 4) ** 2 + (5 - 4) ** 2 + (7 - 4) ** 2) / 3)
    expect(smeMeanAmplitude(trials, times, 0.2, 0.6)).toBeCloseTo(sd / 2, 10)
    expect(smeMeanAmplitude([trials[0]], times, 0.2, 0.6)).toBeNull()
  })

  it('50% area latency sits at the centre of a symmetric component', () => {
    const times = Array.from({ length: 1001 }, (_, i) => i / 1000)
    const wave = times.map((t) => -Math.exp(-((t - 0.4) ** 2) / 0.002))
    expect(Math.abs(areaLatency(times, wave, 0.2, 0.6, 'negative')! - 0.4)).toBeLessThan(0.002)
    expect(areaLatency(times, wave, 0.2, 0.6, 'positive')).toBeNull()
  })
})
