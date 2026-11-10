import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { SidePanel } from '@/components/SidePanel'
import { TopBar } from '@/components/TopBar'
import { Tour } from '@/components/Tour'
import { decodeParams } from '@/lib/share'
import { type StepId, canVisit, stepForKey } from '@/lib/steps'
import { EpochingMain, EpochingPanel } from '@/steps/EpochingStep'
import { ErpMain, ErpPanel } from '@/steps/ErpStep'
import { EventsMain, EventsPanel } from '@/steps/EventsStep'
import { ExportMain } from '@/steps/ExportStep'
import { LearnMain, LearnPanel } from '@/steps/LearnStep'
import { LoadMain, LoadPanel } from '@/steps/LoadStep'
import { useAppStore } from '@/store/useAppStore'

// Steps without controls (Export) have no Panel, so their main content gets the full width.
const VIEWS: Record<StepId, { Panel?: () => React.ReactNode; Main: () => React.ReactNode }> = {
  load: { Panel: LoadPanel, Main: LoadMain },
  events: { Panel: EventsPanel, Main: EventsMain },
  epoching: { Panel: EpochingPanel, Main: EpochingMain },
  erp: { Panel: ErpPanel, Main: ErpMain },
  learn: { Panel: LearnPanel, Main: LearnMain },
  export: { Main: ExportMain },
}

function useShortcuts() {
  const setStep = useAppStore((s) => s.setStep)
  const hasData = useAppStore((s) => s.dataset !== null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'slider')) return
      if (e.key === '[') {
        useAppStore.getState().togglePanel()
        return
      }
      const step = stepForKey(e.key)
      if (step && canVisit(step, hasData)) {
        setStep(step)
        return
      }
      // ← / → nudge the ERP time cursor by 10 ms.
      const s = useAppStore.getState()
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && s.step === 'erp' && s.params) {
        const t = s.timeCursor ?? (s.params.peak_start + s.params.peak_end) / 2
        const next = Math.min(s.params.tmax, Math.max(s.params.tmin, t + (e.key === 'ArrowRight' ? 0.01 : -0.01)))
        s.setTimeCursor(Math.round(next * 1000) / 1000)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasData, setStep])
}

/** A ?p= link carries parameters; they are applied when the next recording loads. */
function useSharedParams() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('p')
    if (!raw) return
    const params = decodeParams(raw)
    if (params) {
      useAppStore.getState().setPendingParams(params)
      toast('Shared settings received', { description: 'They will be applied when you load a recording with the same event codes.' })
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [])
}

/** After a step change, move focus to the new step's title so screen readers announce it. */
function useFocusOnStepChange(step: StepId) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-step-title]')?.focus({ preventScroll: true })
      document.getElementById('main')?.scrollTo({ top: 0 })
    })
    return () => cancelAnimationFrame(id)
  }, [step])
}

export default function App() {
  const step = useAppStore((s) => s.step)
  const hasData = useAppStore((s) => s.dataset !== null && s.params !== null)
  useShortcuts()
  useSharedParams()
  useFocusOnStepChange(step)
  const { Panel, Main } = VIEWS[hasData ? step : 'load']

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:px-4 focus:py-2">
        Skip to content
      </a>
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main id="main" data-tour="main" className="@container min-w-0 flex-1 overflow-y-auto px-5 py-6 [scrollbar-gutter:stable] lg:px-10 lg:py-8">
          <Main />
        </main>
        <SidePanel controls={Panel ? <Panel /> : undefined} />
      </div>
      <Tour />
    </div>
  )
}
