import { PanelLeftCloseIcon, PanelLeftOpenIcon, SlidersHorizontalIcon } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PANEL_MAX, PANEL_MIN, useAppStore } from '@/store/useAppStore'

const PANEL_ID = 'controls-panel'

/**
 * The left controls panel. Drag its right edge (or focus the edge and use the arrow keys) to resize it;
 * collapse it to a slim rail to give the plots more room. Width and state are remembered.
 */
export function SidePanel({ children }: { children: ReactNode }) {
  const width = useAppStore((s) => s.panelWidth)
  const collapsed = useAppStore((s) => s.panelCollapsed)
  const setWidth = useAppStore((s) => s.setPanelWidth)
  const toggle = useAppStore((s) => s.togglePanel)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; width: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
    setDragging(true)
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(drag.current.width + e.clientX - drag.current.x)
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
      ArrowLeft: () => setWidth(width - step),
      ArrowRight: () => setWidth(width + step),
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
        aria-label="Controls (collapsed)"
        data-tour="panel"
        className="bg-card flex shrink-0 items-center gap-3 border-b px-4 py-2 md:w-14 md:flex-col md:border-r md:border-b-0 md:px-0 md:py-4"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                aria-label="Show the controls panel"
                aria-expanded={false}
                aria-controls={PANEL_ID}
                onClick={() => toggle(false)}
              />
            }
          >
            <PanelLeftOpenIcon />
          </TooltipTrigger>
          <TooltipContent side="right">Show controls ( [ )</TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={() => toggle(false)}
          className="text-muted-foreground hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors md:mt-2 md:flex-col"
        >
          <SlidersHorizontalIcon className="size-4" aria-hidden />
          <span className="md:[writing-mode:vertical-rl]">Controls</span>
        </button>
      </aside>
    )
  }

  return (
    <aside
      id={PANEL_ID}
      aria-label="Controls"
      data-tour="panel"
      style={{ '--panel-w': `${width}px` } as React.CSSProperties}
      className="bg-card relative flex max-h-[45vh] shrink-0 flex-col border-b md:max-h-none md:w-[var(--panel-w)] md:border-r md:border-b-0"
    >
      <div className="flex items-center justify-between gap-2 border-b px-5 py-2.5 lg:px-6">
        <span className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontalIcon className="size-4" aria-hidden /> Controls
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Collapse the controls panel"
                aria-expanded
                aria-controls={PANEL_ID}
                onClick={() => toggle(true)}
              />
            }
          >
            <PanelLeftCloseIcon />
          </TooltipTrigger>
          <TooltipContent side="right">Collapse controls ( [ )</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">{children}</div>

      {/* Resize handle: pointer drag, or arrow keys when focused (Shift for bigger steps, Enter collapses). */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the controls panel"
        aria-controls={PANEL_ID}
        aria-valuenow={width}
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(340)}
        onKeyDown={onKeyDown}
        title="Drag to resize · double-click to reset"
        className="group absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize touch-none focus-visible:outline-none md:block"
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
