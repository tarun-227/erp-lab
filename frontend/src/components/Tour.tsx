import { useEffect, useLayoutEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const KEY = 'erp-lab-tour-done'

const STOPS = [
  { target: 'steps', title: 'Six steps', text: 'Work left to right: load data, pick events, epoch, average, then test yourself and export. Keys 1–6 jump between steps.' },
  { target: 'panel', title: 'Parameters', text: 'Every setting for the current step lives here. Hover the ⓘ icons for a short explanation.' },
  { target: 'main', title: 'Linked plots', text: 'Plots update as you move sliders. Click a trial or a time point and the other plots follow.' },
  { target: 'drawer-toggle', title: 'Explain and Tutor', text: 'The book icon opens explanations for each step, and an AI tutor that can see your results.' },
]

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

/** A four-stop first-visit tour; never shown again once finished or skipped. */
export function Tour() {
  const [index, setIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!seen()) setIndex(0)
  }, [])

  useLayoutEffect(() => {
    if (index === null) return
    const update = () => setRect(document.querySelector(`[data-tour="${STOPS[index].target}"]`)?.getBoundingClientRect() ?? null)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [index])

  const finish = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore: the tour may show again next visit */
    }
    setIndex(null)
  }

  if (index === null) return null
  const stop = STOPS[index]
  const width = 300
  const left = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12) : window.innerWidth / 2 - width / 2
  const below = rect ? rect.bottom + 12 + 180 < window.innerHeight : true
  const top = rect ? (below ? rect.bottom + 12 : Math.max(12, rect.top - 192)) : window.innerHeight / 3

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="absolute inset-0 bg-black/40" onClick={finish} />
      {rect && (
        <div
          className="ring-primary pointer-events-none absolute rounded-xl ring-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="bg-popover text-popover-foreground absolute rounded-xl border p-4 shadow-xl" style={{ left, top, width }}>
        <div className="text-muted-foreground text-xs">{index + 1} of {STOPS.length}</div>
        <h2 className="mt-1 text-sm font-semibold">{stop.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{stop.text}</p>
        <div className="mt-3 flex justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
          <Button size="sm" onClick={() => (index + 1 < STOPS.length ? setIndex(index + 1) : finish())}>
            {index + 1 < STOPS.length ? 'Next' : 'Start'}
          </Button>
        </div>
      </div>
    </div>
  )
}
