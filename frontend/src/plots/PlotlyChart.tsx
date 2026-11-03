import type * as P from 'plotly.js'
import { useEffect, useRef, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import type { PlotTheme } from '@/lib/colors'
import type { PlotId } from '@/store/useAppStore'
import { useExpandedHeight } from './expand'

type PlotlyModule = typeof import('plotly.js-dist-min').default
type PlotElement = HTMLDivElement & { on?: (event: string, cb: (e: never) => void) => void }

let plotlyPromise: Promise<PlotlyModule> | null = null
export const loadPlotly = () => (plotlyPromise ??= import('plotly.js-dist-min').then((m) => m.default))

/** Plot elements by id, so "Explain this plot" can export the right one as an image. */
const registry = new Map<PlotId, HTMLDivElement>()

export async function plotPng(id: PlotId): Promise<string | null> {
  const el = registry.get(id)
  if (!el) return null
  const Plotly = await loadPlotly()
  const url = await Plotly.toImage(el, { format: 'png', width: 900, height: 520 })
  return url.replace(/^data:image\/png;base64,/, '')
}

export function baseLayout(theme: PlotTheme, extra: Partial<P.Layout> = {}): Partial<P.Layout> {
  const axis = { gridcolor: theme.grid, zerolinecolor: theme.zero, linecolor: theme.grid, color: theme.muted, automargin: true }
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'DM Sans Variable, ui-sans-serif, system-ui, sans-serif', size: 13, color: theme.text },
    margin: { l: 56, r: 16, t: 12, b: 44 },
    hoverlabel: { font: { family: 'DM Sans Variable, ui-sans-serif, sans-serif', size: 13 }, bordercolor: theme.grid },
    legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', font: { color: theme.text } },
    ...extra,
    xaxis: { ...axis, ...(extra.xaxis ?? {}) },
    yaxis: { ...axis, ...(extra.yaxis ?? {}) },
  }
}

interface PlotlyChartProps {
  id: PlotId
  data: P.Data[]
  layout: Partial<P.Layout>
  height: number
  onClick?: (e: P.PlotMouseEvent) => void
  onHover?: (e: P.PlotMouseEvent) => void
  label: string
}

export function PlotlyChart({ id, data, layout, height: baseHeight, onClick, onHover, label }: PlotlyChartProps) {
  const expanded = useExpandedHeight()
  const height = expanded ?? baseHeight
  const ref = useRef<PlotElement>(null)
  const handlers = useRef({ onClick, onHover })
  const [ready, setReady] = useState(false)
  handlers.current = { onClick, onHover }

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    loadPlotly().then(async (Plotly) => {
      if (cancelled || !el) return
      await Plotly.react(el, data, { ...layout, height, autosize: true }, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        toImageButtonOptions: { filename: `erp-lab-${id}`, scale: 2 },
      })
      if (!ready) {
        el.on?.('plotly_click', (e: never) => handlers.current.onClick?.(e))
        el.on?.('plotly_hover', (e: never) => handlers.current.onHover?.(e))
        registry.set(id, el)
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [data, layout, height, id, ready])

  // Redraw at the new width whenever the container changes size (panel dragged, drawer toggled, plot expanded).
  // Only a real width change triggers a redraw, so a redraw can never feed back into another one.
  useEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box || !ready) return
    let frame = 0
    let lastWidth = Math.round(box.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      if (Math.abs(width - lastWidth) < 2) return
      lastWidth = width
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => loadPlotly().then((Plotly) => Plotly.Plots.resize(el)))
    })
    observer.observe(box)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [ready])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el && registry.get(id) === el) registry.delete(id)
      loadPlotly().then((Plotly) => el && Plotly.purge(el))
    }
  }, [id])

  return (
    <div className="relative" style={{ height }} role="figure" aria-label={label}>
      {!ready && (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  )
}
