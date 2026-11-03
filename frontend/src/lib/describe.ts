import type { ProcessParams } from './types'

// Plain-language descriptions of the processing, so every plot can state its reference, filter and
// baseline as the Keil et al. (2014) publication checklist asks.

export function referenceLabel(reference: string): string {
  if (reference === 'average') return 'average reference'
  if (reference === 'none') return 'recording reference'
  return `${reference} reference`
}

export function filterLabel(p: Pick<ProcessParams, 'l_freq' | 'h_freq'>): string {
  if (p.l_freq && p.h_freq) return `band-pass ${p.l_freq}–${p.h_freq} Hz`
  if (p.l_freq) return `high-pass ${p.l_freq} Hz`
  if (p.h_freq) return `low-pass ${p.h_freq} Hz`
  return 'no filter'
}

export function baselineLabel(p: Pick<ProcessParams, 'baseline' | 'baseline_start' | 'baseline_end'>): string {
  const ms = (s: number) => `${Math.round(s * 1000)}`
  return p.baseline ? `baseline ${ms(p.baseline_start)} to ${ms(p.baseline_end)} ms` : 'no baseline correction'
}
