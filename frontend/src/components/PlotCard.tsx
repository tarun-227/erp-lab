import { InfoIcon, Maximize2Icon, Minimize2Icon, SparklesIcon } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTutor } from '@/hooks/useTutor'
import { cn } from '@/lib/utils'
import { PlotExpandContext } from '@/plots/expand'
import type { PlotId } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'

interface PlotCardProps {
  id: PlotId
  title: string
  subtitle?: ReactNode
  help: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** Height the plot gets in the expanded overlay: the window minus the card's header and padding. */
function useOverlayHeight(active: boolean, reserve: number): number | null {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 600 : window.innerHeight))
  useEffect(() => {
    if (!active) return
    const onResize = () => setH(window.innerHeight)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])
  return active ? Math.max(320, h - reserve) : null
}

export function PlotCard({ id, title, subtitle, help, actions, children, className }: PlotCardProps) {
  const { explainPlot } = useTutor()
  const highlight = useAppStore((s) => s.highlight)
  const highlighted = highlight?.plot === id
  const [expanded, setExpanded] = useState(false)
  const header = useRef<HTMLElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  // Keep room for the header, padding and any slider under the plot.
  const [reserve, setReserve] = useState(220)
  const overlayHeight = useOverlayHeight(expanded, reserve)

  const close = () => {
    setExpanded(false)
    requestAnimationFrame(() => expandButton.current?.focus())
  }

  useEffect(() => {
    if (!expanded) return
    setReserve((header.current?.offsetHeight ?? 120) + 110)
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // close only touches refs and state setters, so it is safe to leave out of the dependencies.
  }, [expanded])

  const titleId = `plot-${id}-title`
  return (
    <>
      {expanded && <div aria-hidden className="animate-in fade-in fixed inset-0 z-40 bg-[#0F1024]/45 duration-200" onClick={close} />}
      <section
        data-plot={id}
        aria-labelledby={titleId}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        className={cn(
          'bg-card shadow-soft rounded-[20px] border p-5 transition-shadow duration-200',
          highlighted && 'ring-primary/60 ring-4',
          expanded && 'shadow-pop animate-in fade-in zoom-in-[0.98] fixed inset-3 z-50 overflow-y-auto duration-200 md:inset-6 lg:p-7',
          className,
        )}
      >
        <header ref={header} className="mb-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[14rem] flex-1">
              <div className="flex items-center gap-1.5">
                <h2 id={titleId} className={cn('leading-6 font-extrabold', expanded ? 'text-2xl leading-8' : 'text-lg')}>
                  {title}
                </h2>
                <Tooltip>
                  <TooltipTrigger
                    aria-label={`About the ${title} plot`}
                    className="text-muted-foreground hover:text-primary flex size-7 items-center justify-center rounded-full transition-colors"
                  >
                    <InfoIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-80">{help}</TooltipContent>
                </Tooltip>
              </div>
              {subtitle && <div className="text-muted-foreground mt-1 max-w-[75ch] text-sm leading-snug">{subtitle}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => explainPlot(id, title)}>
                <SparklesIcon /> <span className="hidden sm:inline">Explain this plot</span>
                <span className="sr-only sm:hidden">Explain this plot</span>
              </Button>
              {expanded ? (
                <Button ref={closeButton} variant="outline" size="sm" onClick={close} aria-label={`Close the enlarged ${title} plot`}>
                  <Minimize2Icon /> <span className="hidden sm:inline">Close</span>
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        ref={expandButton}
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Enlarge the ${title} plot`}
                        onClick={() => setExpanded(true)}
                      />
                    }
                  >
                    <Maximize2Icon />
                  </TooltipTrigger>
                  <TooltipContent>Enlarge (Esc to close)</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {highlighted && highlight?.note && (
          <p className="bg-primary-soft text-secondary-foreground mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
            <SparklesIcon className="text-primary size-4 shrink-0" aria-hidden /> Tutor: {highlight.note}
          </p>
        )}
        <PlotExpandContext.Provider value={overlayHeight}>{children}</PlotExpandContext.Provider>
      </section>
    </>
  )
}
