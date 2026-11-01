import { useEffect } from 'react'
import { toast } from 'sonner'
import { ExplainDrawer } from '@/components/ExplainDrawer'
import { TopBar } from '@/components/TopBar'
import { Tour } from '@/components/Tour'
import { decodeParams } from '@/lib/share'
import { type StepId, canVisit, stepForKey } from '@/lib/steps'
import { EpochingMain, EpochingPanel } from '@/steps/EpochingStep'
import { ErpMain, ErpPanel } from '@/steps/ErpStep'
import { EventsMain, EventsPanel } from '@/steps/EventsStep'
import { ExportMain, ExportPanel } from '@/steps/ExportStep'
import { LearnMain, LearnPanel } from '@/steps/LearnStep'
import { LoadMain, LoadPanel } from '@/steps/LoadStep'
import { useAppStore } from '@/store/useAppStore'

const VIEWS: Record<StepId, { Panel: () => React.ReactNode; Main: () => React.ReactNode }> = {
  load: { Panel: LoadPanel, Main: LoadMain },
  events: { Panel: EventsPanel, Main: EventsMain },
  epoching: { Panel: EpochingPanel, Main: EpochingMain },
  erp: { Panel: ErpPanel, Main: ErpMain },
  learn: { Panel: LearnPanel, Main: LearnMain },
  export: { Panel: ExportPanel, Main: ExportMain },
}

function useShortcuts() {
  const setStep = useAppStore((s) => s.setStep)
  const hasData = useAppStore((s) => s.dataset !== null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'slider')) return
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

export default function App() {
  const step = useAppStore((s) => s.step)
  const hasData = useAppStore((s) => s.dataset !== null && s.params !== null)
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  useShortcuts()
  useSharedParams()
  const { Panel, Main } = VIEWS[hasData ? step : 'load']

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">
        Skip to content
      </a>
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          aria-label="Parameters"
          data-tour="panel"
          className="bg-muted/30 max-h-[45vh] shrink-0 overflow-y-auto border-b p-5 md:max-h-none md:w-80 md:border-r md:border-b-0"
        >
          <Panel />
        </aside>
        <main id="main" data-tour="main" className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <Main />
        </main>
        {drawerOpen && <ExplainDrawer />}
      </div>
      <Tour />
    </div>
  )
}
