import { BookOpenIcon, PanelRightCloseIcon, SlidersHorizontalIcon, SparklesIcon } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, type PanelTab, useAppStore } from '@/store/useAppStore'
import { GuideContent } from './GuideContent'
import { TutorChat } from './TutorChat'

const PANEL_ID = 'side-panel'

const TABS: { id: PanelTab; label: string; icon: typeof BookOpenIcon }[] = [
  { id: 'controls', label: 'Controls', icon: SlidersHorizontalIcon },
  { id: 'explain', label: 'Guide', icon: BookOpenIcon },
  { id: 'tutor', label: 'Tutor', icon: SparklesIcon },
]

/**
 * One panel to the right of the plots, with three tabs: the step's Controls, the Guide and the Tutor. Only one
 * shows at a time, so the plots keep most of the width. Drag its left edge (or focus the edge and use the arrow
 * keys) to resize it; collapse it to a slim rail. Width and state are remembered. On narrow screens it sits
 * above the plots instead. Steps without settings (Export) have no Controls tab.
 */
export function SidePanel({ controls }: { controls?: ReactNode }) {
  const width = useAppStore((s) => s.panelWidth)
  const collapsed = useAppStore((s) => s.panelCollapsed)
  const stored = useAppStore((s) => s.panelTab)
  const setWidth = useAppStore((s) => s.setPanelWidth)
  const toggle = useAppStore((s) => s.togglePanel)
  const setTab = useAppStore((s) => s.setPanelTab)
  const openPanel = useAppStore((s) => s.openPanel)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const tabs = TABS.filter((t) => t.id !== 'controls' || controls)
  const tab = !controls && stored === 'controls' ? 'explain' : stored

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
    setDragging(true)
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(drag.current.width - (e.clientX - drag.current.x))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    drag.current = null
    setDragging(false)
    document.body.style.userSelect = ''
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16
    const keys: Record<string, () => void> = {
      ArrowLeft: () => setWidth(width + step),
      ArrowRight: () => setWidth(width - step),
      Home: () => setWidth(PANEL_MIN),
      End: () => setWidth(PANEL_MAX),
      Enter: () => toggle(true),
    }
    if (keys[e.key]) {
      e.preventDefault()
      e.stopPropagation()
      keys[e.key]()
    }
  }

  if (collapsed) {
    return (
      <aside
        aria-label="Side panel (collapsed)"
        data-tour="panel"
        className="bg-card flex shrink-0 items-center gap-2 border-b px-4 py-2 max-md:order-first md:w-14 md:flex-col md:border-b-0 md:border-l md:px-0 md:py-4"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <Button
                  variant={id === tab ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label={`Open ${label}`}
                  aria-expanded={false}
                  aria-controls={PANEL_ID}
                  onClick={() => openPanel(id)}
                />
              }
            >
              <Icon />
            </TooltipTrigger>
            <TooltipContent side="left">{label} ( [ )</TooltipContent>
          </Tooltip>
        ))}
      </aside>
    )
  }

  return (
    <aside
      id={PANEL_ID}
      aria-label="Controls, guide and tutor"
      data-tour="panel"
      style={{ '--panel-w': `${width}px` } as React.CSSProperties}
      className="bg-card relative flex max-h-[45vh] shrink-0 flex-col border-b max-md:order-first md:max-h-none md:w-[var(--panel-w)] md:border-b-0 md:border-l"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as PanelTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-2 border-b p-3">
          <TabsList className="flex-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id}>
                <Icon /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Collapse the side panel"
                  aria-expanded
                  aria-controls={PANEL_ID}
                  onClick={() => toggle(true)}
                />
              }
            >
              <PanelRightCloseIcon />
            </TooltipTrigger>
            <TooltipContent side="left">Collapse ( [ )</TooltipContent>
          </Tooltip>
        </div>

        {controls && (
          <TabsContent value="controls" className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
            {controls}
          </TabsContent>
        )}
        <TabsContent value="explain" className="min-h-0 flex-1 overflow-y-auto p-5">
          <GuideContent />
        </TabsContent>
        <TabsContent value="tutor" className="flex min-h-0 flex-1 flex-col">
          <TutorChat />
        </TabsContent>
      </Tabs>

      {/* Resize handle: pointer drag, or arrow keys when focused (Shift for bigger steps, Enter collapses). */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the side panel"
        aria-controls={PANEL_ID}
        aria-valuenow={width}
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(PANEL_DEFAULT)}
        onKeyDown={onKeyDown}
        title="Drag to resize · double-click to reset"
        className="group absolute inset-y-0 -left-2 z-20 hidden w-4 cursor-col-resize touch-none focus-visible:outline-none md:block"
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-150',
            dragging ? 'bg-primary w-1' : 'group-hover:bg-primary/50 group-focus-visible:bg-primary bg-transparent group-focus-visible:w-1',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'bg-card shadow-soft absolute top-1/2 left-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border transition-opacity duration-150',
            dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          <span className="bg-muted-foreground/60 size-0.5 rounded-full" />
          <span className="bg-muted-foreground/60 size-0.5 rounded-full" />
          <span className="bg-muted-foreground/60 size-0.5 rounded-full" />
        </span>
      </div>
    </aside>
  )
}
