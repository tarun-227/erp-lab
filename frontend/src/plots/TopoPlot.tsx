import type * as P from 'plotly.js'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlotCard } from '@/components/PlotCard'
import { usePlotTheme } from '@/hooks/usePlotTheme'
import { useTopo } from '@/hooks/useProcess'
import { referenceLabel } from '@/lib/describe'
import { nearestIndex, topoGrid } from '@/lib/erp'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

const SCALE: [number, string][] = [
  [0, '#2166ac'], [0.25, '#67a9cf'], [0.5, '#f7f7f7'], [0.75, '#ef8a62'], [1, '#b2182b'],
]

export function TopoPlot({ result }: { result: ProcessResult }) {
  const { data: layout, error } = useTopo()
  const params = useAppStore((s) => s.params!)
  const setParams = useAppStore((s) => s.setParams)
  const cursor = useAppStore((s) => s.timeCursor)
  const setCursor = useAppStore((s) => s.setTimeCursor)
  const target = useAppStore((s) => s.topoTarget)
  const setTarget = useAppStore((s) => s.setTopoTarget)
  const theme = usePlotTheme()
  const [playing, setPlaying] = useState(false)

  const available = result.conditions.filter((c) => c.topo_mean)
  const canDiff = available.length === 2
  const options = [...available.map((c) => c.name), ...(canDiff ? ['difference'] : [])]
  const current = target && options.includes(target) ? target : (canDiff ? 'difference' : options[0])
  // Until the student moves the cursor, open at the peak of whatever the map is showing.
  const shown = current === 'difference' ? result.difference : result.conditions.find((c) => c.name === current)
  const time = cursor ?? shown?.peak?.latency_s ?? (params.peak_start + params.peak_end) / 2

  // Channels × times for the chosen condition or the difference wave.
  const matrix = useMemo(() => {
    if (current === 'difference' && canDiff) {
      const [a, b] = available
      return b.topo_mean!.map((row, ch) => row.map((v, t) => v - a.topo_mean![ch][t]))
    }
    return available.find((c) => c.name === current)?.topo_mean ?? null
  }, [available, canDiff, current])

  useEffect(() => {
    if (!playing) return
    const times = result.times
    let t = cursor !== null && cursor < times[times.length - 1] - 0.01 ? cursor : times[0]
    const id = setInterval(() => {
      t += 0.01
      if (t > times[times.length - 1]) {
        setPlaying(false)
        return
      }
      setCursor(t)
    }, 40)
    return () => clearInterval(id)
    // Only restarts when play is toggled, not on every cursor move.
  }, [playing])

  const figure = useMemo(() => {
    if (!layout || !matrix) return null
    const ti = nearestIndex(result.times, time)
    const idx = layout.ch_names.map((ch) => result.ch_names.indexOf(ch))
    const values = idx.map((i) => (i >= 0 ? matrix[i][ti] : 0))
    let zmax = 0
    idx.forEach((i) => i >= 0 && matrix[i].forEach((v) => (zmax = Math.max(zmax, Math.abs(v)))))
    zmax = zmax || 1
    const r = layout.radius
    const traces: P.Data[] = [
      {
        type: 'contour', x: layout.axis, y: layout.axis, z: topoGrid(layout.weights, layout.inside, layout.axis.length, values),
        colorscale: SCALE, zmin: -zmax, zmax, zmid: 0, connectgaps: false, ncontours: 14,
        contours: { coloring: 'heatmap', showlines: true }, line: { color: 'rgba(0,0,0,0.25)', width: 0.5, smoothing: 1 },
        colorbar: { title: { text: 'µV', side: 'right' }, thickness: 10, len: 0.8, tickfont: { color: theme.muted } },
        hovertemplate: '%{z:.2f} µV<extra></extra>',
      } as P.Data,
      {
        type: 'scatter', mode: 'markers', x: layout.x, y: layout.y, text: layout.ch_names,
        customdata: values,
        marker: {
          size: layout.ch_names.map((c) => (c === result.channel ? 11 : 6)),
          color: layout.ch_names.map((c) => (c === result.channel ? theme.accent : theme.dark ? '#e5e5e5' : '#222')),
          line: { color: theme.dark ? '#111' : '#fff', width: 1 },
        },
        hovertemplate: '%{text}: %{customdata:.2f} µV<br>click to select<extra></extra>', showlegend: false,
      },
    ]
    const head = theme.dark ? '#d4d4d4' : '#404040'
    const shapes: Partial<P.Shape>[] = [
      { type: 'circle', xref: 'x', yref: 'y', x0: -r, x1: r, y0: -r, y1: r, line: { color: head, width: 2 } },
      { type: 'path', path: `M ${-0.12 * r} ${0.99 * r} L 0 ${1.12 * r} L ${0.12 * r} ${0.99 * r}`, line: { color: head, width: 2 } },
      { type: 'path', path: `M ${-r} ${0.15 * r} Q ${-1.1 * r} 0 ${-r} ${-0.15 * r}`, line: { color: head, width: 2 } },
      { type: 'path', path: `M ${r} ${0.15 * r} Q ${1.1 * r} 0 ${r} ${-0.15 * r}`, line: { color: head, width: 2 } },
    ]
    const axis = { visible: false, range: [-1.2 * r, 1.2 * r], fixedrange: true }
    return {
      traces,
      time: result.times[ti],
      layout: baseLayout(theme, {
        margin: { l: 8, r: 8, t: 8, b: 8 }, shapes,
        xaxis: { ...axis, scaleanchor: 'y' } as Partial<P.LayoutAxis>,
        yaxis: axis as Partial<P.LayoutAxis>,
      }),
    }
  }, [layout, matrix, result, time, theme])

  if (error || !result) {
    return (
      <PlotCard id="topomap" title="Scalp map" help="Voltage across the scalp at one moment.">
        <p className="text-muted-foreground py-10 text-center text-sm">{(error as Error)?.message ?? 'No electrode positions.'}</p>
      </PlotCard>
    )
  }

  return (
    <PlotCard
      id="topomap"
      title={`Scalp map at ${figure ? Math.round(figure.time * 1000) : '–'} ms`}
      subtitle="Click an electrode to plot its ERP. Press play to watch the map change over time."
      help="Voltage across the head at the time cursor, seen from above with the nose at the top. Values between electrodes are filled in by thin-plate spline interpolation. A P3 is a positive (red) patch over the back of the head; an ERN is a negative (blue) patch near the top."
      actions={
        <>
          <select
            aria-label="Condition shown on the scalp map"
            value={current}
            onChange={(e) => setTarget(e.target.value)}
            className="border-input bg-card h-9 rounded-lg border px-2.5 text-sm"
          >
            {options.map((o) => (
              <option key={o} value={o}>{o === 'difference' ? `difference (${available[1]?.name} − ${available[0]?.name})` : o}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)}>
            {playing ? <PauseIcon /> : <PlayIcon />} {playing ? 'Pause' : 'Play'}
          </Button>
        </>
      }
    >
      {figure ? (
        <PlotlyChart
          id="topomap" label={`Scalp map of ${current} at ${Math.round(figure.time * 1000)} ms`} data={figure.traces} layout={figure.layout} height={440}
          onClick={(e) => {
            const pt = e.points[0]
            if (pt && pt.curveNumber === 1 && typeof pt.text === 'string') setParams({ channel: pt.text })
          }}
        />
      ) : (
        <div className="bg-muted h-[440px] animate-pulse rounded-2xl" />
      )}
      <p className="text-muted-foreground mt-2 text-sm">
        Top view, nose up · thin-plate spline interpolation · {referenceLabel(params.reference)} · colour bar in µV · dots are electrodes
      </p>
    </PlotCard>
  )
}
