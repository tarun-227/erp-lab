import type * as P from 'plotly.js'
import { ArrowDownUpIcon, PinIcon, PinOffIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlotCard } from '@/components/PlotCard'
import { useErpWaves } from '@/hooks/useErp'
import { useConditionColors, usePlotTheme } from '@/hooks/usePlotTheme'
import { hexToRgba } from '@/lib/colors'
import { baselineLabel, filterLabel, referenceLabel } from '@/lib/describe'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

export function ErpPlot({ result }: { result: ProcessResult }) {
  const params = useAppStore((s) => s.params!)
  const cursor = useAppStore((s) => s.timeCursor)
  const setCursor = useAppStore((s) => s.setTimeCursor)
  const ghost = useAppStore((s) => s.ghost)
  const setGhost = useAppStore((s) => s.setGhost)
  const highlight = useAppStore((s) => s.highlight)
  const theme = usePlotTheme()
  const colorOf = useConditionColors()
  const erp = useErpWaves(result)
  const [showCI, setShowCI] = useState(true)
  const [showDiff, setShowDiff] = useState(true)
  const [negativeUp, setNegativeUp] = useState(false)

  const figure = useMemo(() => {
    if (!erp) return null
    const t = result.times
    const traces: P.Data[] = []
    erp.waves.forEach((w) => {
      if (!w.n) return
      const color = colorOf(w.name)
      if (showCI && w.n > 1) {
        traces.push({
          type: 'scatter', x: [...t, ...t.slice().reverse()],
          y: [...w.mean.map((m, i) => m + w.ci[i]), ...w.mean.map((m, i) => m - w.ci[i]).reverse()],
          fill: 'toself', fillcolor: hexToRgba(color, 0.16), line: { width: 0 }, hoverinfo: 'skip', showlegend: false,
        })
      }
      traces.push({
        type: 'scatter', mode: 'lines', x: t, y: w.mean, name: `${w.name} (n=${w.n})`,
        line: { color, width: 2.2 }, hovertemplate: `${w.name}: %{y:.2f} µV at %{x:.3f} s<extra></extra>`,
      })
      if (w.peak) {
        traces.push({
          type: 'scatter', mode: 'markers', x: [w.peak.latency_s], y: [w.peak.amplitude_uv], showlegend: false,
          marker: { color, size: 9, symbol: 'diamond', line: { color: theme.dark ? '#111' : '#fff', width: 1.5 } },
          hovertemplate: `${w.name} peak: %{y:.2f} µV at %{x:.3f} s<extra></extra>`,
        })
      }
    })
    if (showDiff && erp.difference) {
      traces.push({
        type: 'scatter', mode: 'lines', x: t, y: erp.difference.mean, name: erp.difference.name,
        line: { color: theme.text, width: 1.6, dash: 'dot' }, hovertemplate: 'difference: %{y:.2f} µV<extra></extra>',
      })
    }
    if (ghost && ghost.channel === result.channel) {
      ghost.waves.forEach((g) => {
        traces.push({
          type: 'scatter', mode: 'lines', x: ghost.times, y: g.mean, name: `${g.name} (pinned: ${ghost.label})`,
          line: { color: hexToRgba(colorOf(g.name), 0.55), width: 1.5, dash: 'dash' }, hoverinfo: 'skip',
        })
      })
    }

    const shapes: Partial<P.Shape>[] = [
      { type: 'rect', xref: 'x', yref: 'paper', x0: params.peak_start, x1: params.peak_end, y0: 0, y1: 1, fillcolor: hexToRgba(theme.accent, 0.08), line: { width: 0 }, layer: 'below' },
      { type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1, line: { color: theme.zero, width: 1 } },
    ]
    if (params.baseline) {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: params.baseline_start, x1: params.baseline_end, y0: 0, y1: 0.04, fillcolor: theme.muted, opacity: 0.35, line: { width: 0 } })
    }
    if (cursor !== null) shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: cursor, x1: cursor, y0: 0, y1: 1, line: { color: theme.accent, width: 1.5, dash: 'dash' } })
    if (highlight?.plot === 'erp' && highlight.start_s !== undefined && highlight.end_s !== undefined) {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: highlight.start_s, x1: highlight.end_s, y0: 0, y1: 1, line: { color: theme.accent, width: 2, dash: 'dash' }, fillcolor: 'rgba(0,0,0,0)' })
    }
    const layout = baseLayout(theme, {
      shapes,
      hovermode: 'x unified',
      xaxis: { title: { text: 'Time from event (s)' } },
      yaxis: { title: { text: `${result.channel} (µV, ${negativeUp ? 'negative' : 'positive'} up)` }, autorange: negativeUp ? 'reversed' : true },
      annotations: [
        { xref: 'x', yref: 'paper', x: (params.peak_start + params.peak_end) / 2, y: 1, yanchor: 'bottom', text: 'peak window', showarrow: false, font: { size: 11, color: theme.muted } },
        ...(params.baseline
          ? [{ xref: 'x' as const, yref: 'paper' as const, x: (params.baseline_start + params.baseline_end) / 2, y: 0.045, yanchor: 'bottom' as const, text: 'baseline', showarrow: false, font: { size: 11, color: theme.muted } }]
          : []),
      ],
    })
    return { traces, layout }
  }, [erp, result, params, cursor, ghost, highlight, showCI, showDiff, negativeUp, theme, colorOf])

  const summary = erp
    ? `ERP at ${result.channel}. ` +
      erp.waves
        .filter((w) => w.peak)
        .map((w) => `${w.name}: peak ${w.peak!.amplitude_uv.toFixed(1)} µV at ${Math.round(w.peak!.latency_s * 1000)} ms from ${w.n} trials`)
        .join('; ')
    : `ERP at ${result.channel}`

  const pin = () => {
    if (!erp) return
    const label = `${params.l_freq || 0}–${params.h_freq || '∞'} Hz, ${params.reference} ref, reject ${params.reject_uv || 'off'}`
    setGhost({ label, channel: result.channel, times: result.times, waves: erp.waves.filter((w) => w.n).map((w) => ({ name: w.name, mean: w.mean })) })
  }

  return (
    <PlotCard
      id="erp"
      title={`ERP at ${result.channel}`}
      subtitle={
        <>
          <span className="text-foreground font-medium">
            {referenceLabel(params.reference)} · {filterLabel(params)} · {baselineLabel(params)}
          </span>
          <br />
          Click anywhere to move the time cursor; the scalp map follows it. Shaded bands are 95% confidence intervals.
        </>
      }
      help="The average of all kept epochs for each condition. The diamond marks the peak inside the shaded window. Pin the current curves, change a parameter, and compare."
      actions={
        <>
          <Button variant={showCI ? 'secondary' : 'outline'} size="sm" aria-pressed={showCI} onClick={() => setShowCI(!showCI)}>Confidence bands</Button>
          {erp?.difference && (
            <Button variant={showDiff ? 'secondary' : 'outline'} size="sm" aria-pressed={showDiff} onClick={() => setShowDiff(!showDiff)}>Difference wave</Button>
          )}
          <Button variant={negativeUp ? 'secondary' : 'outline'} size="sm" aria-pressed={negativeUp} title="Plot negative voltages upwards (a common ERP convention)" onClick={() => setNegativeUp(!negativeUp)}>
            <ArrowDownUpIcon /> Neg. up
          </Button>
          {ghost ? (
            <Button variant="outline" size="sm" onClick={() => setGhost(null)}><PinOffIcon /> Unpin</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={pin}><PinIcon /> Pin to compare</Button>
          )}
        </>
      }
    >
      {figure && (
        <PlotlyChart
          id="erp" label={summary} data={figure.traces} layout={figure.layout} height={480}
          onClick={(e) => setCursor(Number(e.points[0]?.x))}
        />
      )}
    </PlotCard>
  )
}
