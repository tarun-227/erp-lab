import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const KEY = 'erp-lab-tour-done'

const STOPS = [
  { target: 'steps', title: 'Your lesson path', text: 'Six short steps, left to right: load data, pick events, cut epochs, average them, test yourself, then export. Keys 1–6 jump between steps.' },
  { target: 'main', title: 'Live, linked plots', text: 'Plots update as you move a slider. Click a trial or a moment in time and the other plots follow.' },
  { target: 'panel', title: 'Controls, Guide and Tutor', text: 'The Controls tab holds every setting for the current step; each ⓘ explains one in plain words. Switch to Guide for background and ideas to try, or Tutor to ask about your own results.' },
]

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

/** A three-stop first-visit tour; never shown again once finished or skipped. */
export function Tour() {
  const [index, setIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const next = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (index === null) return
    next.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
  const width = 320
  const left = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12) : window.innerWidth / 2 - width / 2
  const below = rect ? rect.bottom + 12 + 180 < window.innerHeight : true
  const top = rect ? (below ? rect.bottom + 12 : Math.max(12, rect.top - 192)) : window.innerHeight / 3

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="absolute inset-0 bg-black/40" onClick={finish} />
      {rect && (
        <div
          className="ring-primary pointer-events-none absolute rounded-2xl ring-4 shadow-[0_0_0_9999px_rgba(15,16,36,0.35)]"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="bg-popover text-popover-foreground shadow-pop absolute rounded-2xl border p-5" style={{ left, top, width }}>
        <p className="sr-only">Stop {index + 1} of {STOPS.length}</p>
        <div className="flex gap-1.5" aria-hidden>
          {STOPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === index ? 'bg-primary w-5' : 'bg-muted w-1.5'}`} />
          ))}
        </div>
        <h2 className="mt-3 text-lg font-extrabold">{stop.title}</h2>
        <p className="text-muted-foreground mt-1 text-[15px] leading-snug">{stop.text}</p>
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
          <Button ref={next} size="sm" onClick={() => (index + 1 < STOPS.length ? setIndex(index + 1) : finish())}>
            {index + 1 < STOPS.length ? 'Next' : 'Start'}
          </Button>
        </div>
      </div>
    </div>
  )
}
