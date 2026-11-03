import type * as P from 'plotly.js'
import { useMemo } from 'react'
import { PlotCard } from '@/components/PlotCard'
import { usePlotTheme } from '@/hooks/usePlotTheme'
import { hexToRgba } from '@/lib/colors'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

// Blue = first condition larger, red = second larger (same sign as the difference wave).
const DIVERGING: [number, string][] = [
  [0, '#2166ac'], [0.25, '#67a9cf'], [0.5, '#f7f7f7'], [0.75, '#ef8a62'], [1, '#b2182b'],
]

/**
 * Signed r² for every channel × time point: how well the voltage there separates the two conditions.
 * The standard BCI view for choosing channels and time windows (Blankertz et al., 2011, NeuroImage 56:814).
 */
export function R2Plot({ result }: { result: ProcessResult }) {
  const params = useAppStore((s) => s.params!)
  const setParams = useAppStore((s) => s.setParams)
  const cursor = useAppStore((s) => s.timeCursor)
  const setCursor = useAppStore((s) => s.setTimeCursor)
  const theme = usePlotTheme()
  const disc = result.discriminability

  const figure = useMemo(() => {
    if (!disc) return null
    const zmax = disc.max_abs || 1
    const traces: P.Data[] = [
      {
        type: 'heatmap', x: result.times, y: disc.ch_names, z: disc.values,
        zmin: -zmax, zmax, zmid: 0, colorscale: DIVERGING,
        colorbar: { title: { text: 'signed r²', side: 'right' }, thickness: 10, len: 0.9, tickfont: { color: theme.muted } },
        hovertemplate: '%{y} at %{x:.3f} s<br>signed r² %{z:.3f}<br>click to show this channel and time<extra></extra>',
      } as P.Data,
    ]
    const row = disc.ch_names.indexOf(result.channel)
    const shapes: Partial<P.Shape>[] = [
      { type: 'rect', xref: 'x', yref: 'paper', x0: params.peak_start, x1: params.peak_end, y0: 0, y1: 1, line: { color: theme.text, width: 1, dash: 'dot' }, fillcolor: 'rgba(0,0,0,0)' },
      { type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1, line: { color: theme.zero, width: 1 } },
    ]
    if (row >= 0) {
      shapes.push({ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: row - 0.5, y1: row + 0.5, line: { color: theme.accent, width: 2 }, fillcolor: hexToRgba(theme.accent, 0.04) })
    }
    if (cursor !== null) shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: cursor, x1: cursor, y0: 0, y1: 1, line: { color: theme.accent, width: 1.5, dash: 'dash' } })
    return {
      traces,
      height: Math.min(640, 90 + disc.ch_names.length * 16),
      layout: baseLayout(theme, {
        margin: { l: 52, r: 8, t: 8, b: 44 },
        shapes,
        xaxis: { title: { text: 'Time from event (s)' } },
        yaxis: { type: 'category', autorange: 'reversed', title: { text: 'front → back' }, tickfont: { size: 11 }, showgrid: false },
      }),
    }
  }, [disc, result.times, result.channel, params.peak_start, params.peak_end, cursor, theme])

  const strongest = useMemo(() => {
    if (!disc) return null
    let best = { v: 0, ch: '', t: 0 }
    disc.values.forEach((row, i) =>
      row.forEach((v, j) => {
        if (Math.abs(v) > Math.abs(best.v)) best = { v, ch: disc.ch_names[i], t: result.times[j] }
      }),
    )
    return best
  }, [disc, result.times])

  const [a, b] = disc?.label.split(' − ').reverse() ?? ['', '']
  return (
    <PlotCard
      id="r2"
      title="Where and when do the conditions differ?"
      subtitle={
        disc && strongest ? (
          <span>
            Signed r² for every channel and moment ({disc.label}): red where <b>{b}</b> is more positive, blue where <b>{a}</b> is.
            Strongest at <b>{strongest.ch}</b>, {Math.round(strongest.t * 1000)} ms ({strongest.v.toFixed(3)}). Click a cell to plot it.
          </span>
        ) : undefined
      }
      help="r² is the share of the single-trial variance at that channel and time explained by the condition (0 = no separation, 1 = perfect). The sign says which condition is larger. BCIs use this map to choose the channels and time windows a classifier should look at (Blankertz et al., 2011)."
    >
      {figure ? (
        <PlotlyChart
          id="r2"
          label={`Signed r² map, ${disc!.label}. Strongest separation ${strongest!.v.toFixed(3)} at ${strongest!.ch}, ${Math.round(strongest!.t * 1000)} ms`}
          data={figure.traces}
          layout={figure.layout}
          height={figure.height}
          onClick={(e) => {
            const pt = e.points[0]
            if (!pt) return
            if (typeof pt.y === 'string') setParams({ channel: pt.y })
            setCursor(Number(pt.x))
          }}
        />
      ) : (
        <p className="text-muted-foreground py-8 text-center text-[15px]">
          Pick exactly two conditions in the Events step (each with at least two kept epochs) to compare them here.
        </p>
      )}
    </PlotCard>
  )
}
