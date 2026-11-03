import type * as P from 'plotly.js'
import { useMemo } from 'react'
import { PlotCard } from '@/components/PlotCard'
import { usePlotTheme } from '@/hooks/usePlotTheme'
import { REJECT_COLOR } from '@/lib/colors'
import type { ProcessResult } from '@/lib/types'
import { PlotlyChart, baseLayout } from './PlotlyChart'

export function DropLogChart({ result }: { result: ProcessResult }) {
  const theme = usePlotTheme()
  const { drop } = result
  const figure = useMemo(() => {
    const entries = Object.entries(drop.by_channel).slice(0, 8)
    if (drop.edge) entries.push(['Too close to edge', drop.edge])
    const labels = entries.map(([k]) => k).reverse()
    const values = entries.map(([, v]) => v).reverse()
    const traces: P.Data[] = [
      {
        type: 'bar', orientation: 'h', x: values, y: labels, text: values.map(String), textposition: 'outside',
        marker: { color: labels.map((l) => (l === 'Too close to edge' ? theme.muted : REJECT_COLOR)) },
        hovertemplate: '%{y}: %{x} epochs<extra></extra>', cliponaxis: false,
      },
    ]
    return {
      traces,
      layout: baseLayout(theme, {
        margin: { l: 110, r: 30, t: 4, b: 30 },
        xaxis: { title: { text: 'Epochs dropped' }, rangemode: 'tozero', dtick: Math.max(...values, 0) <= 10 ? 1 : undefined },
        yaxis: { automargin: true },
        bargap: 0.35,
      }),
      height: 90 + 32 * Math.max(1, labels.length),
    }
  }, [drop, theme])

  return (
    <PlotCard
      id="drop"
      title="Why epochs were dropped"
      subtitle="Each rejected epoch is blamed on the channel with the largest peak-to-peak swing."
      help="Rejection removes epochs whose voltage swings more than the threshold on any channel. Blinks show up on frontal channels (Fp1, Fp2). Epochs whose window runs past the start or end of the recording are always dropped."
    >
      {drop.rejected + drop.edge === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No epochs were dropped with these settings.</p>
      ) : (
        <PlotlyChart id="drop" label="Dropped epochs per channel" data={figure.traces} layout={figure.layout} height={figure.height} />
      )}
    </PlotCard>
  )
}
