import { create } from 'zustand'
import { defaultParams } from '@/lib/presets'
import type { SampleId } from '@/lib/samples'
import type { StepId } from '@/lib/steps'
import type { LoadResponse, ProcessParams } from '@/lib/types'

type DrawerTab = 'explain' | 'tutor'
export type LoadSource = 'sample' | 'upload'
export type PlotId = 'raw' | 'erp_image' | 'erp' | 'topomap' | 'events' | 'drop' | 'noise' | 'r2'

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

const QUIZ_KEY = 'erp-lab-quiz'

function loadQuiz(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveQuiz(answers: Record<number, number>) {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(answers))
  } catch {
    /* storage unavailable: progress is just not remembered */
  }
}

const PANEL_KEY = 'erp-lab-panel'
export const PANEL_MIN = 260
export const PANEL_MAX = 560
const PANEL_DEFAULT = 340

function loadPanel(): { width: number; collapsed: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}')
    const width = Number.isFinite(p.width) ? Math.min(PANEL_MAX, Math.max(PANEL_MIN, p.width)) : PANEL_DEFAULT
    return { width, collapsed: Boolean(p.collapsed) }
  } catch {
    return { width: PANEL_DEFAULT, collapsed: false }
  }
}

function savePanel(width: number, collapsed: boolean) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify({ width, collapsed }))
  } catch {
    /* storage unavailable: the panel just resets next visit */
  }
}

// The drawer sits beside the content on wide screens and over it on narrow ones, so start it closed there.
const wideScreen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches

interface AppState {
  step: StepId
  /** Steps the student has opened, for the progress meter. */
  visited: StepId[]
  loadSource: LoadSource
  /** The bundled recording picked in the Load step. */
  sampleId: SampleId
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
  /** Left controls panel: width in px, and whether it is collapsed to a rail. Remembered per browser. */
  panelWidth: number
  panelCollapsed: boolean
  tutorMessages: TutorMessage[]
  socratic: boolean
  /** Built-in quiz answers by question index, remembered in this browser. */
  quizAnswers: Record<number, number>

  setStep: (step: StepId) => void
  setLoadSource: (source: LoadSource) => void
  setSampleId: (id: SampleId) => void
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
  setPanelWidth: (width: number) => void
  togglePanel: (collapsed?: boolean) => void
  setDrawerTab: (tab: DrawerTab) => void
  setSocratic: (on: boolean) => void
  pushTutorMessage: (m: TutorMessage) => void
  updateTutorMessage: (id: string, update: (m: TutorMessage) => TutorMessage) => void
  clearTutor: () => void
  answerQuiz: (question: number, choice: number) => void
  resetQuiz: () => void
}

export const useAppStore = create<AppState>((set) => ({
  step: 'load',
  visited: ['load'],
  loadSource: 'sample',
  sampleId: 'flanker',
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
  panelWidth: loadPanel().width,
  panelCollapsed: loadPanel().collapsed,
  drawerTab: 'explain',
  tutorMessages: [],
  socratic: true,
  quizAnswers: loadQuiz(),

  setStep: (step) => set((s) => ({ step, visited: s.visited.includes(step) ? s.visited : [...s.visited, step] })),
  setLoadSource: (loadSource) => set({ loadSource }),
  setSampleId: (sampleId) => set({ sampleId }),
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
  setPanelWidth: (width) =>
    set((s) => {
      const panelWidth = Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)))
      savePanel(panelWidth, s.panelCollapsed)
      return { panelWidth }
    }),
  togglePanel: (collapsed) =>
    set((s) => {
      const panelCollapsed = collapsed ?? !s.panelCollapsed
      savePanel(s.panelWidth, panelCollapsed)
      return { panelCollapsed }
    }),
  setDrawerTab: (drawerTab) => set({ drawerTab }),
  setSocratic: (socratic) => set({ socratic }),
  pushTutorMessage: (m) => set((s) => ({ tutorMessages: [...s.tutorMessages, m] })),
  updateTutorMessage: (id, update) =>
    set((s) => ({ tutorMessages: s.tutorMessages.map((m) => (m.id === id ? update(m) : m)) })),
  clearTutor: () => set({ tutorMessages: [] }),
  answerQuiz: (question, choice) =>
    set((s) => {
      const quizAnswers = { ...s.quizAnswers, [question]: choice }
      saveQuiz(quizAnswers)
      return { quizAnswers }
    }),
  resetQuiz: () => {
    saveQuiz({})
    set({ quizAnswers: {} })
  },
}))
