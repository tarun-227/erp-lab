import { useMemo } from 'react'
import { areaLatency, averageWithCI, findPeak, meanInWindow, smeMeanAmplitude } from '@/lib/erp'
import type { Peak, ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'

export interface Wave {
  name: string
  n: number
  nAvailable: number
  mean: number[]
  ci: number[]
  peak: Peak | null
  meanAmp: number | null
  area50: number | null
  sme: number | null
}

/**
 * Condition averages computed in the browser from the single trials, so the
 * "trials averaged" slider needs no server round trip. Uses the first N kept trials.
 */
export function useErpWaves(result: ProcessResult | undefined) {
  const params = useAppStore((s) => s.params)
  const trialsN = useAppStore((s) => s.trialsN)

  return useMemo(() => {
    if (!result || !params) return null
    const waves: Wave[] = params.conditions.map((c) => {
      const rows = result.trials.filter((_, i) => result.kept[i] && result.labels[i] === c.name)
      const used = trialsN ? rows.slice(0, trialsN) : rows
      const { mean, ci } = averageWithCI(used)
      return {
        name: c.name,
        n: used.length,
        nAvailable: rows.length,
        mean,
        ci,
        peak: used.length ? findPeak(result.times, mean, params.peak_start, params.peak_end, params.polarity) : null,
        meanAmp: used.length ? meanInWindow(result.times, mean, params.peak_start, params.peak_end) : null,
        area50: used.length ? areaLatency(result.times, mean, params.peak_start, params.peak_end, params.polarity) : null,
        sme: smeMeanAmplitude(used, result.times, params.peak_start, params.peak_end),
      }
    })
    let difference: Wave | null = null
    if (waves.length === 2 && waves[0].n && waves[1].n) {
      const [a, b] = waves
      const mean = b.mean.map((v, i) => v - a.mean[i])
      difference = {
        name: `${b.name} − ${a.name}`,
        n: Math.min(a.n, b.n),
        nAvailable: Math.min(a.nAvailable, b.nAvailable),
        mean,
        ci: mean.map(() => 0),
        peak: findPeak(result.times, mean, params.peak_start, params.peak_end, params.polarity),
        meanAmp: meanInWindow(result.times, mean, params.peak_start, params.peak_end),
        area50: areaLatency(result.times, mean, params.peak_start, params.peak_end, params.polarity),
        // Independent conditions: the errors add in quadrature.
        sme: a.sme !== null && b.sme !== null ? Math.hypot(a.sme, b.sme) : null,
      }
    }
    const maxN = Math.max(0, ...waves.map((w) => w.nAvailable))
    return { waves, difference, maxN }
  }, [result, params, trialsN])
}
