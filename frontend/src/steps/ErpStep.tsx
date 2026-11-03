import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Nudge, PanelSection, ParamControl, RangeControl, fmt } from '@/components/ParamControl'
import { ProcessStatus } from '@/components/ProcessStatus'
import { useErpWaves, type Wave } from '@/hooks/useErp'
import { useConditionColors } from '@/hooks/usePlotTheme'
import { useProcess } from '@/hooks/useProcess'
import { cn } from '@/lib/utils'
import { ErpPlot } from '@/plots/ErpPlot'
import { NoisePlot } from '@/plots/NoisePlot'
import { R2Plot } from '@/plots/R2Plot'
import { TopoPlot } from '@/plots/TopoPlot'
import { useAppStore } from '@/store/useAppStore'
import { ChannelSelect } from './EpochingStep'
import { StepHeader } from './StepHeader'

const COMPONENTS = [
  { label: 'N1', start: 0.07, end: 0.15, polarity: 'negative' as const, hint: 'early sensory response, ~100 ms' },
  { label: 'P300', start: 0.25, end: 0.5, polarity: 'positive' as const, hint: 'rare, task-relevant stimuli' },
  { label: 'ERN', start: 0, end: 0.1, polarity: 'negative' as const, hint: 'after an error response' },
  { label: 'Pe', start: 0.2, end: 0.5, polarity: 'positive' as const, hint: 'error positivity, central-parietal, after the ERN' },
]

export function ErpPanel() {
  const p = useAppStore((s) => s.params!)
  const setParams = useAppStore((s) => s.setParams)
  const trialsN = useAppStore((s) => s.trialsN)
  const setTrialsN = useAppStore((s) => s.setTrialsN)
  const { data } = useProcess()
  const erp = useErpWaves(data)
  const maxN = erp?.maxN ?? 1

  return (
    <div className="space-y-6">
      <PanelSection title="Component">
        <div className="flex flex-wrap gap-1.5">
          {COMPONENTS.map((c) => (
            <Button
              key={c.label} size="sm" title={c.hint}
              variant={p.peak_start === c.start && p.peak_end === c.end && p.polarity === c.polarity ? 'secondary' : 'outline'}
              onClick={() => setParams({ peak_start: c.start, peak_end: c.end, polarity: c.polarity })}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <RangeControl
          id="peak-window" label="Peak window" value={[p.peak_start, p.peak_end]} min={p.tmin} max={p.tmax} step={0.01}
          format={fmt.ms} minGap={0.02}
          help="Where to look for the component. The peak and the mean amplitude are measured inside this window."
          onChange={([peak_start, peak_end]) => setParams({ peak_start, peak_end })}
        />
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Peak polarity">
          {(['positive', 'negative'] as const).map((pol) => (
            <Button key={pol} size="sm" role="radio" aria-checked={p.polarity === pol} variant={p.polarity === pol ? 'secondary' : 'outline'} onClick={() => setParams({ polarity: pol })}>
              {pol === 'positive' ? 'Positive peak' : 'Negative peak'}
            </Button>
          ))}
        </div>
        <ChannelSelect />
      </PanelSection>

      <PanelSection title="Averaging">
        <ParamControl
          id="trials-n" label="Trials averaged" value={trialsN ?? maxN} min={1} max={Math.max(1, maxN)} step={1}
          format={(v) => (trialsN === null || v >= maxN ? `all (${maxN})` : `${v} per condition`)}
          help="Use only the first N kept trials of each condition. Start at 1 and slide up: the noise shrinks and the ERP emerges."
          onChange={(v) => setTrialsN(v >= maxN ? null : v)}
        />
        <div className="flex gap-1.5">
          {[1, 5, 20].filter((n) => n < maxN).map((n) => (
            <Button key={n} size="xs" variant="outline" onClick={() => setTrialsN(n)}>{n}</Button>
          ))}
          <Button size="xs" variant="outline" onClick={() => setTrialsN(null)}>All</Button>
        </div>
        {erp && erp.waves.some((w) => w.n > 0 && w.n < 20) && (
          <Nudge>Fewer than 20 trials in a condition: its average is still noisy, so be careful reading its peak.</Nudge>
        )}
      </PanelSection>
    </div>
  )
}

const COLUMNS: { label: string; help: string }[] = [
  { label: 'Trials', help: 'Kept epochs averaged for this condition.' },
  { label: 'Mean amplitude', help: 'Average voltage in the window. The most robust amplitude measure (ERP CORE), because it does not hunt for noise peaks.' },
  { label: 'SME', help: 'Standardized measurement error of the mean amplitude: the SD of single-trial window means divided by √N (Luck et al., 2021). The expected error of this score; fewer trials or more noise make it larger.' },
  { label: 'Peak latency', help: 'Time of the most positive (or negative) point in the window.' },
  { label: 'Peak amplitude', help: 'Voltage at that peak. Biased away from zero by noise, so prefer the mean amplitude for comparisons.' },
  { label: '50% area latency', help: 'Time that splits the component area in the window in half. ERP CORE found it far more stable than peak latency.' },
]

function PeakTable({ waves, difference }: { waves: Wave[]; difference: Wave | null }) {
  const colorOf = useConditionColors()
  const p = useAppStore((s) => s.params!)
  const rows = difference ? [...waves, difference] : waves
  const uv = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(2)} µV`)
  return (
    <div className="bg-card shadow-soft overflow-x-auto rounded-[20px] border">
      <table className="w-full text-sm">
        <caption className="px-5 pt-4 text-left">
          <span className="font-heading block text-lg font-extrabold">Measurements</span>
          <span className="text-muted-foreground text-sm">
            In the window {fmt.ms(p.peak_start)} to {fmt.ms(p.peak_end)} at {p.channel}, looking for a {p.polarity} component. Hover a
            column name for what it means.
          </span>
        </caption>
        <thead className="text-muted-foreground text-sm">
          <tr className="border-b">
            <th scope="col" className="px-5 py-2.5 text-left font-medium">Condition</th>
            {COLUMNS.map((c) => (
              <th key={c.label} scope="col" className="px-5 py-2.5 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">{c.label}</TooltipTrigger>
                  <TooltipContent className="max-w-72">{c.help}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular text-[15px]">
          {rows.map((w) => {
            const isDiff = w === difference
            return (
              <tr key={w.name} className={cn('border-b last:border-0', isDiff && 'bg-muted/40')}>
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: isDiff ? 'var(--foreground)' : colorOf(w.name) }} />
                    {isDiff ? `Difference: ${w.name}` : w.name}
                  </span>
                </th>
                <td className="px-5 py-3 text-right">{isDiff ? '–' : w.n}</td>
                <td className="px-5 py-3 text-right font-semibold">{uv(w.meanAmp)}</td>
                <td className="px-5 py-3 text-right">{w.sme !== null ? `±${w.sme.toFixed(2)} µV` : '–'}</td>
                <td className="px-5 py-3 text-right">{w.peak ? fmt.ms(w.peak.latency_s) : '–'}</td>
                <td className="px-5 py-3 text-right">{uv(w.peak?.amplitude_uv)}</td>
                <td className="px-5 py-3 text-right">{w.area50 !== null ? fmt.ms(w.area50) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ErpMain() {
  const { data, isFetching, error } = useProcess()
  const erp = useErpWaves(data)
  const setStep = useAppStore((s) => s.setStep)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <StepHeader
        id="erp"
        title="Average epochs into ERPs"
        text="Averaging keeps activity that is time-locked to the event and cancels the rest. Compare conditions, find the peak, and see where on the scalp it is largest."
        aside={<ProcessStatus isFetching={isFetching} error={error} />}
      />
      {data && erp ? (
        <>
          <div className="grid gap-6 @4xl:grid-cols-[3fr_2fr]">
            <ErpPlot result={data} />
            <TopoPlot result={data} />
          </div>
          <R2Plot result={data} />
          <PeakTable waves={erp.waves} difference={erp.difference} />
          <NoisePlot result={data} />
          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStep('learn')}>
              Check your understanding <ArrowRightIcon />
            </Button>
          </div>
        </>
      ) : (
        !error && <div role="status" className="bg-muted h-96 animate-pulse rounded-[20px]"><span className="sr-only">Loading ERPs…</span></div>
      )}
    </div>
  )
}
