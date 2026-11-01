export const STEPS = [
  { id: 'load', label: 'Load data', hint: 'Pick a recording' },
  { id: 'events', label: 'Events', hint: 'Name your conditions' },
  { id: 'epoching', label: 'Epoching', hint: 'Cut the signal into trials' },
  { id: 'erp', label: 'ERP', hint: 'Average and compare' },
  { id: 'learn', label: 'Learn & Quiz', hint: 'Check your understanding' },
  { id: 'export', label: 'Export', hint: 'Take the pipeline with you' },
] as const

export type StepId = (typeof STEPS)[number]['id']

/** Every step after Load needs a recording first. */
export function canVisit(step: StepId, hasData: boolean): boolean {
  return step === 'load' || hasData
}

/** Maps the keys 1–6 to steps; returns null for anything else. */
export function stepForKey(key: string): StepId | null {
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= STEPS.length ? STEPS[n - 1].id : null
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`
}
