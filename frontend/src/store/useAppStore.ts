import { create } from 'zustand'
import { defaultParams } from '@/lib/presets'
import type { StepId } from '@/lib/steps'
import type { LoadResponse, ProcessParams } from '@/lib/types'

type DrawerTab = 'explain' | 'tutor'
export type LoadSource = 'sample' | 'upload'
export type PlotId = 'raw' | 'erp_image' | 'erp' | 'topomap' | 'events' | 'drop' | 'noise'

export interface Highlight {
  plot: PlotId
  start_s?: number
  end_s?: number
  channel?: string
  note?: string
}

export interface Ghost {
  label: string
  channel: string
  times: number[]
  waves: { name: string; mean: number[] }[]
}

export interface TutorAction {
  id: string
  changes: Partial<ProcessParams>
  title: string
  watch: string
  state: 'pending' | 'applied' | 'undone'
  /** Parameters before Apply, restored by Undo. */
  previous?: ProcessParams
}

export interface TutorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  plot?: string
  actions?: TutorAction[]
  navigate?: { step: StepId; reason: string }
  highlights?: Highlight[]
  error?: { kind: string; message: string }
  streaming?: boolean
}

/** A shared parameter set only applies if the recording has its event codes and channel. */
function fitsDataset(p: ProcessParams | null, dataset: LoadResponse): p is ProcessParams {
  return Boolean(
    p &&
      p.conditions.every((c) => String(c.code) in dataset.summary.event_counts) &&
      dataset.summary.ch_names.includes(p.channel),
  )
}

// The drawer sits beside the content on wide screens and over it on narrow ones, so start it closed there.
const wideScreen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches

interface AppState {
  step: StepId
  loadSource: LoadSource
  dataset: LoadResponse | null
  params: ProcessParams | null
  /** Earlier parameter sets, for undoing presets and tutor suggestions. */
  history: ProcessParams[]
  /** Parameters from a shared link, applied when the next dataset loads. */
  pendingParams: ProcessParams | null
  timeCursor: number | null
  selectedTrial: number | null
  highlight: Highlight | null
  ghost: Ghost | null
  trialsN: number | null
  topoTarget: string | null
  rawStart: number
  drawerOpen: boolean
  drawerTab: DrawerTab
  tutorMessages: TutorMessage[]
  socratic: boolean

  setStep: (step: StepId) => void
  setLoadSource: (source: LoadSource) => void
  setDataset: (dataset: LoadResponse) => void
  setParams: (patch: Partial<ProcessParams>) => void
  replaceParams: (next: ProcessParams) => void
  undoParams: () => void
  setPendingParams: (p: ProcessParams | null) => void
  setTimeCursor: (t: number | null) => void
  setSelectedTrial: (i: number | null) => void
  setHighlight: (h: Highlight | null) => void
  setGhost: (g: Ghost | null) => void
  setTrialsN: (n: number | null) => void
  setTopoTarget: (t: string | null) => void
  setRawStart: (s: number) => void
  toggleDrawer: (open?: boolean) => void
  setDrawerTab: (tab: DrawerTab) => void
  setSocratic: (on: boolean) => void
  pushTutorMessage: (m: TutorMessage) => void
  updateTutorMessage: (id: string, update: (m: TutorMessage) => TutorMessage) => void
  clearTutor: () => void
}

export const useAppStore = create<AppState>((set) => ({
  step: 'load',
  loadSource: 'sample',
  dataset: null,
  params: null,
  history: [],
  pendingParams: null,
  timeCursor: null,
  selectedTrial: null,
  highlight: null,
  ghost: null,
  trialsN: null,
  topoTarget: null,
  rawStart: 0,
  drawerOpen: wideScreen(),
  drawerTab: 'explain',
  tutorMessages: [],
  socratic: true,

  setStep: (step) => set({ step }),
  setLoadSource: (loadSource) => set({ loadSource }),
  setDataset: (dataset) =>
    set((s) => ({
      dataset,
      params: fitsDataset(s.pendingParams, dataset) ? s.pendingParams : defaultParams(dataset),
      pendingParams: null,
      history: [],
      timeCursor: null,
      selectedTrial: null,
      highlight: null,
      ghost: null,
      trialsN: null,
      topoTarget: null,
      rawStart: 0,
    })),
  setParams: (patch) => set((s) => (s.params ? { params: { ...s.params, ...patch } } : {})),
  replaceParams: (next) =>
    set((s) => ({ params: next, history: s.params ? [...s.history.slice(-19), s.params] : s.history })),
  undoParams: () =>
    set((s) => (s.history.length ? { params: s.history[s.history.length - 1], history: s.history.slice(0, -1) } : {})),
  setPendingParams: (pendingParams) => set({ pendingParams }),
  setTimeCursor: (timeCursor) => set({ timeCursor }),
  setSelectedTrial: (selectedTrial) => set({ selectedTrial }),
  setHighlight: (highlight) => set({ highlight }),
  setGhost: (ghost) => set({ ghost }),
  setTrialsN: (trialsN) => set({ trialsN }),
  setTopoTarget: (topoTarget) => set({ topoTarget }),
  setRawStart: (rawStart) => set({ rawStart: Math.max(0, rawStart) }),
  toggleDrawer: (open) => set((s) => ({ drawerOpen: open ?? !s.drawerOpen })),
  setDrawerTab: (drawerTab) => set({ drawerTab }),
  setSocratic: (socratic) => set({ socratic }),
  pushTutorMessage: (m) => set((s) => ({ tutorMessages: [...s.tutorMessages, m] })),
  updateTutorMessage: (id, update) =>
    set((s) => ({ tutorMessages: s.tutorMessages.map((m) => (m.id === id ? update(m) : m)) })),
  clearTutor: () => set({ tutorMessages: [] }),
}))
