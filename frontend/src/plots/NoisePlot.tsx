import type * as P from 'plotly.js'
import { useMemo } from 'react'
import { PlotCard } from '@/components/PlotCard'
import { usePlotTheme } from '@/hooks/usePlotTheme'
import { noiseCurve, trialSteps } from '@/lib/erp'
import type { ProcessResult } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'
import { PlotlyChart, baseLayout } from './PlotlyChart'

/** Measured noise after averaging N trials against the 1/√N prediction. */
export function NoisePlot({ result }: { result: ProcessResult }) {
  const params = useAppStore((s) => s.params!)
  const trialsN = useAppStore((s) => s.trialsN)
  const theme = usePlotTheme()

  const curve = useMemo(() => {
    // Use the condition with the most kept trials, and the pre-stimulus part of the epoch as "pure noise".
    const counts = params.conditions.map((c) => result.labels.filter((l, i) => l === c.name && result.kept[i]).length)
    const best = params.conditions[counts.indexOf(Math.max(...counts))]
    if (!best) return null
    const trials = result.trials.filter((_, i) => result.kept[i] && result.labels[i] === best.name)
    if (trials.length < 2) return null
    const [b0, b1] = params.baseline ? [params.baseline_start, params.baseline_end] : [params.tmin, 0]
    const mask = result.times.map((t) => t >= b0 && t <= b1)
    if (!mask.some(Boolean)) return null
    return { condition: best.name, ...noiseCurve(trials, mask, trialSteps(trials.length)) }
  }, [result, params])

  const figure = useMemo(() => {
    if (!curve) return null
    const traces: P.Data[] = [
      { type: 'scatter', mode: 'lines', x: curve.ns, y: curve.theory, name: '1/√N prediction', line: { color: theme.muted, dash: 'dash', width: 1.5 } },
      { type: 'scatter', mode: 'lines+markers', x: curve.ns, y: curve.measured, name: 'measured', line: { color: theme.accent, width: 2 }, marker: { size: 6 } },
    ]
    const shapes: Partial<P.Shape>[] = trialsN
      ? [{ type: 'line', xref: 'x', yref: 'paper', x0: trialsN, x1: trialsN, y0: 0, y1: 1, line: { color: theme.accent, width: 1, dash: 'dot' } }]
      : []
    return {
      traces,
      layout: baseLayout(theme, {
        margin: { l: 52, r: 12, t: 26, b: 42 }, shapes,
        xaxis: { type: 'log', title: { text: 'Trials averaged (N)' } },
        yaxis: { type: 'log', title: { text: 'Noise (µV)' } },
      }),
    }
  }, [curve, trialsN, theme])

  return (
    <PlotCard
      id="noise"
      title="Why averaging works"
      subtitle={curve ? `Noise left in the baseline of '${curve.condition}' after averaging N random trials.` : undefined}
      help="Random noise shrinks with the square root of the number of trials: 4× the trials halves the noise. If the measured line sits above the prediction, the noise is not independent across trials (for example slow drifts)."
    >
      {figure ? (
        <PlotlyChart id="noise" label="Noise versus number of trials" data={figure.traces} layout={figure.layout} height={240} />
      ) : (
        <p className="text-muted-foreground py-8 text-center text-sm">Need at least two kept trials and a baseline window.</p>
      )}
    </PlotCard>
  )
}
