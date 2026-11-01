import type * as P from 'plotly.js'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, CrosshairIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PlotCard } from '@/components/PlotCard'
import { useDebounced } from '@/hooks/useProcess'
import { useConditionColors, usePlotTheme } from '@/hooks/usePlotTheme'
import { api } from '@/lib/api'
import { REJECT_COLOR, hexToRgba } from '@/lib/colors'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

const WINDOW_S = 10

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

export function RawPlot({ result }: { result: ProcessResult }) {
  const sid = useAppStore((s) => s.dataset!.session_id)
  const params = useAppStore((s) => s.params!)
  const rawStart = useAppStore((s) => s.rawStart)
  const setRawStart = useAppStore((s) => s.setRawStart)
  const selected = useAppStore((s) => s.selectedTrial)
  const setSelected = useAppStore((s) => s.setSelectedTrial)
  const highlight = useAppStore((s) => s.highlight)
  const theme = usePlotTheme()
  const colorOf = useConditionColors()
  const debounced = useDebounced(params)
  const start = useDebounced(rawStart, 120)

  const { data: raw } = useQuery({
    queryKey: ['raw', sid, debounced.l_freq, debounced.h_freq, debounced.reference, start],
    queryFn: ({ signal }) => api.raw(sid, debounced, start, WINDOW_S, signal),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })
  const total = raw?.duration_total_s ?? 0

  // Recordings often start before the task: open the view at the first event, once per recording.
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (opened.current === sid || !result.event_times_s.length) return
    opened.current = sid
    const first = Math.min(...result.event_times_s)
    if (useAppStore.getState().rawStart === 0 && first > 1) setRawStart(first - 1)
  }, [sid, result.event_times_s, setRawStart])

  // Keep the selected epoch in view when it is picked from another plot.
  useEffect(() => {
    if (selected === null) return
    const onset = result.event_times_s[selected]
    if (onset === undefined) return
    const { rawStart: current, setRawStart: setStart } = useAppStore.getState()
    if (onset + params.tmin < current || onset + params.tmax > current + WINDOW_S) setStart(Math.max(0, onset - WINDOW_S / 2))
  }, [selected, result.event_times_s, params.tmin, params.tmax])

  const figure = useMemo(() => {
    if (!raw) return null
    const spacing = Math.max(20, 5 * median(raw.data.map((ch) => {
      const m = ch.reduce((a, b) => a + b, 0) / ch.length
      return Math.sqrt(ch.reduce((a, b) => a + (b - m) ** 2, 0) / ch.length)
    })))
    const traces: P.Data[] = raw.data.map((ch, i) => ({
      type: 'scattergl',
      mode: 'lines',
      x: raw.times,
      y: ch.map((v) => v - i * spacing),
      name: raw.ch_names[i],
      line: { width: raw.ch_names[i] === result.channel ? 1.6 : 0.8, color: raw.ch_names[i] === result.channel ? theme.accent : theme.muted },
      hovertemplate: `${raw.ch_names[i]}: %{customdata:.1f} µV<extra></extra>`,
      customdata: ch,
      showlegend: false,
    }))

    const t0 = raw.times[0] ?? start
    const t1 = raw.times[raw.times.length - 1] ?? start + WINDOW_S
    const shapes: Partial<P.Shape>[] = []
    result.event_times_s.forEach((onset, i) => {
      if (onset + params.tmax < t0 || onset + params.tmin > t1) return
      const kept = result.kept[i]
      const color = colorOf(result.labels[i])
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: onset + params.tmin, x1: onset + params.tmax, y0: 0, y1: 1,
        fillcolor: kept ? hexToRgba(color, 0.12) : hexToRgba(REJECT_COLOR, 0.16),
        line: i === selected ? { color: theme.accent, width: 2 } : { width: 0 },
        layer: 'below',
      })
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper', x0: onset, x1: onset, y0: 0, y1: 1,
        line: { color: kept ? color : REJECT_COLOR, width: 1, dash: 'dot' },
      })
    })
    if (highlight?.plot === 'raw' && highlight.start_s !== undefined && highlight.end_s !== undefined) {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: highlight.start_s, x1: highlight.end_s, y0: 0, y1: 1,
        line: { color: theme.accent, width: 2, dash: 'dash' }, fillcolor: 'rgba(0,0,0,0)',
      })
    }
    const layout = baseLayout(theme, {
      margin: { l: 48, r: 12, t: 8, b: 40 },
      shapes,
      xaxis: { title: { text: 'Time in recording (s)' }, range: [t0, t1] },
      yaxis: {
        tickvals: raw.ch_names.map((_, i) => -i * spacing),
        ticktext: raw.ch_names,
        zeroline: false,
        showgrid: false,
        range: [-(raw.ch_names.length - 0.3) * spacing, spacing * 1.2],
        fixedrange: true,
      },
      hovermode: 'closest',
    })
    return { traces, layout, height: Math.min(520, 120 + raw.ch_names.length * 18) }
  }, [raw, result, params.tmin, params.tmax, selected, highlight, theme, colorOf, start])

  const onClick = (e: P.PlotMouseEvent) => {
    const x = Number(e.points[0]?.x)
    let best: number | null = null
    result.event_times_s.forEach((onset, i) => {
      if (x >= onset + params.tmin && x <= onset + params.tmax) {
        if (best === null || Math.abs(onset - x) < Math.abs(result.event_times_s[best] - x)) best = i
      }
    })
    if (best !== null) setSelected(best)
  }

  return (
    <PlotCard
      id="raw"
      title="Continuous EEG with epoch windows"
      subtitle={
        <span>
          Shaded boxes are epochs (coloured = kept, red = rejected). Click a box to select that trial. Showing{' '}
          {start.toFixed(0)}–{(start + WINDOW_S).toFixed(0)} s of {total.toFixed(0)} s.
        </span>
      }
      help="The filtered, re-referenced recording. Each box is the window cut out around one event; dotted lines mark the events. Change the epoch window or filters and watch the boxes and traces update."
      actions={
        <>
          <Button variant="outline" size="icon-sm" aria-label="Earlier" onClick={() => setRawStart(rawStart - WINDOW_S / 2)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Later" onClick={() => setRawStart(Math.min(rawStart + WINDOW_S / 2, Math.max(0, total - WINDOW_S)))}>
            <ChevronRightIcon />
          </Button>
          {selected !== null && (
            <Button variant="outline" size="sm" onClick={() => setRawStart(Math.max(0, result.event_times_s[selected] - WINDOW_S / 2))}>
              <CrosshairIcon /> Trial #{selected + 1}
            </Button>
          )}
        </>
      }
    >
      {figure ? (
        <PlotlyChart id="raw" label="Continuous EEG with epoch windows" data={figure.traces} layout={figure.layout} height={figure.height} onClick={onClick} />
      ) : (
        <div className="bg-muted/40 h-72 animate-pulse rounded-lg" />
      )}
      {total > WINDOW_S && (
        <Slider
          aria-label="Position in the recording"
          className="mt-3"
          value={[Math.min(rawStart, total - WINDOW_S)]}
          min={0}
          max={Math.max(0, total - WINDOW_S)}
          step={0.5}
          onValueChange={(v) => setRawStart((v as number[])[0])}
        />
      )}
    </PlotCard>
  )
}
