import type * as P from 'plotly.js'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlotCard } from '@/components/PlotCard'
import { useConditionColors, usePlotTheme } from '@/hooks/usePlotTheme'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

const DIVERGING: [number, string][] = [
  [0, '#2166ac'], [0.25, '#67a9cf'], [0.5, '#f7f7f7'], [0.75, '#ef8a62'], [1, '#b2182b'],
]

function percentileAbs(rows: number[][], q: number): number {
  const all: number[] = []
  rows.forEach((r) => r.forEach((v) => all.push(Math.abs(v))))
  if (!all.length) return 1
  all.sort((a, b) => a - b)
  return all[Math.floor(q * (all.length - 1))] || 1
}

export function ErpImagePlot({ result }: { result: ProcessResult }) {
  const conditions = useAppStore((s) => s.params!.conditions)
  const selected = useAppStore((s) => s.selectedTrial)
  const setSelected = useAppStore((s) => s.setSelectedTrial)
  const cursor = useAppStore((s) => s.timeCursor)
  const theme = usePlotTheme()
  const colorOf = useConditionColors()
  const [grouped, setGrouped] = useState(true)

  const figure = useMemo(() => {
    const n = result.trials.length
    const rank = new Map(conditions.map((c, i) => [c.name, i]))
    const order = Array.from({ length: n }, (_, i) => i)
    if (grouped) order.sort((a, b) => (rank.get(result.labels[a])! - rank.get(result.labels[b])!) || a - b)

    const rowLabel = (i: number) => `#${i + 1} · ${result.labels[i]}${result.kept[i] ? '' : ' · rejected'}`
    const y = order.map(rowLabel)
    const keptZ = order.map((i) => (result.kept[i] ? result.trials[i] : result.trials[i].map(() => null)))
    const rejZ = order.map((i) => (result.kept[i] ? result.trials[i].map(() => null) : result.trials[i]))
    const zmax = percentileAbs(result.trials.filter((_, i) => result.kept[i]), 0.98)
    const hover = `%{y}<br>%{x:.3f} s: %{z:.1f} µV<extra></extra>`

    const traces: P.Data[] = [
      {
        type: 'heatmap', x: result.times, y, z: keptZ, zmin: -zmax, zmax, zmid: 0, colorscale: DIVERGING,
        colorbar: { title: { text: 'µV', side: 'right' }, thickness: 10, len: 0.9, tickfont: { color: theme.muted } },
        hoverongaps: false, hovertemplate: hover,
      } as P.Data,
      {
        type: 'heatmap', x: result.times, y, z: rejZ, zmin: -zmax * 3, zmax: zmax * 3,
        colorscale: [[0, '#6b6b6b'], [1, '#d4d4d4']], showscale: false, hoverongaps: false, hovertemplate: hover, opacity: 0.55,
      } as P.Data,
    ]

    const shapes: Partial<P.Shape>[] = [
      { type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1, line: { color: theme.zero, width: 1 } },
    ]
    const annotations: Partial<P.Annotations>[] = []
    if (grouped) {
      let startRow = 0
      conditions.forEach((c) => {
        const count = order.filter((i) => result.labels[i] === c.name).length
        if (!count) return
        if (startRow > 0) {
          shapes.push({ type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: startRow - 0.5, y1: startRow - 0.5, line: { color: theme.text, width: 1 } })
        }
        annotations.push({
          xref: 'paper', yref: 'y', x: 0, xanchor: 'right', y: startRow + count / 2 - 0.5,
          text: `<b>${c.name}</b>`, showarrow: false, font: { color: colorOf(c.name), size: 11 }, textangle: '-90',
        })
        startRow += count
      })
    }
    if (selected !== null) {
      const row = order.indexOf(selected)
      if (row >= 0) shapes.push({ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: row - 0.5, y1: row + 0.5, line: { color: theme.accent, width: 2 } })
    }
    if (cursor !== null) shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: cursor, x1: cursor, y0: 0, y1: 1, line: { color: theme.accent, width: 1.5, dash: 'dash' } })

    const layout = baseLayout(theme, {
      margin: { l: 28, r: 8, t: 8, b: 40 },
      shapes, annotations,
      xaxis: { title: { text: 'Time from event (s)' } },
      yaxis: { showticklabels: false, autorange: 'reversed', showgrid: false, zeroline: false },
    })
    return { traces, layout, order }
  }, [result, conditions, grouped, selected, cursor, theme, colorOf])

  const onClick = (e: P.PlotMouseEvent) => {
    const label = String(e.points[0]?.y ?? '')
    const match = label.match(/^#(\d+)/)
    if (match) setSelected(Number(match[1]) - 1)
  }

  const sel = selected !== null ? selected : null
  return (
    <PlotCard
      id="erp_image"
      title="ERP image: every trial"
      subtitle={
        sel !== null ? (
          <span>
            Trial #{sel + 1} ({result.labels[sel]}): {result.kept[sel] ? 'kept' : `rejected, ${result.max_ptp_uv[sel]} µV swing on ${result.worst_channel[sel]}`}
          </span>
        ) : (
          <span>One row per epoch at {result.channel}; grey rows are rejected. Click a row to find it in the raw signal.</span>
        )
      }
      help="Each row is one epoch, coloured by voltage. Activity that is time-locked to the event forms vertical stripes; noise looks random. Rejected epochs are greyed out."
      actions={
        <Button variant="outline" size="sm" onClick={() => setGrouped(!grouped)}>
          {grouped ? 'Show in time order' : 'Group by condition'}
        </Button>
      }
    >
      <PlotlyChart id="erp_image" label={`ERP image at ${result.channel}: ${result.trials.length} epochs, ${result.drop.rejected} rejected`} data={figure.traces} layout={figure.layout} height={480} onClick={onClick} />
    </PlotCard>
  )
}
