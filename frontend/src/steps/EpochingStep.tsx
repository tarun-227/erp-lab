import { ArrowRightIcon, CheckCircle2Icon, ScissorsIcon, TagsIcon, XCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Nudge, PanelSection, ParamControl, RangeControl, SelectControl, SwitchControl, fmt } from '@/components/ParamControl'
import { ProcessStatus } from '@/components/ProcessStatus'
import { useKeptToast, useProcess } from '@/hooks/useProcess'
import { HIGH_PASS, lowPassOptions } from '@/lib/presets'
import type { DropSummary, ProcessParams } from '@/lib/types'
import { DropLogChart } from '@/plots/DropLogChart'
import { ErpImagePlot } from '@/plots/ErpImagePlot'
import { RawPlot } from '@/plots/RawPlot'
import { useAppStore } from '@/store/useAppStore'
import { Stat, StepHeader } from './StepHeader'


const nearest = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0)

/** Keep the baseline inside the epoch window when the window moves. */
export function withEpochWindow(p: ProcessParams, tmin: number, tmax: number): Partial<ProcessParams> {
  const baseline_start = Math.min(Math.max(p.baseline_start, tmin), 0)
  const baseline_end = Math.max(Math.min(p.baseline_end, tmax), baseline_start + 0.05)
  return { tmin, tmax, baseline_start, baseline_end }
}

export function ChannelSelect() {
  const dataset = useAppStore((s) => s.dataset!)
  const channel = useAppStore((s) => s.params!.channel)
  const setParams = useAppStore((s) => s.setParams)
  return (
    <SelectControl
      id="channel" label="Channel shown" value={channel}
      options={dataset.summary.ch_names.map((c) => ({ value: c, label: c }))}
      help="The electrode whose single trials and ERP are plotted. You can also click an electrode on the scalp map."
      onChange={(c) => setParams({ channel: c })}
    />
  )
}

/** Events that never became epochs: off the recording edge, inside a BAD segment, or duplicated. */
function NotCutStat({ drop }: { drop: DropSummary }) {
  const parts: [number, string][] = [
    [drop.edge, 'off the recording edge'],
    [drop.bad_span ?? 0, 'in bad segments'],
    [drop.duplicate ?? 0, 'duplicate events'],
  ]
  const total = parts.reduce((n, [k]) => n + k, 0)
  if (total === drop.edge) return <Stat icon={ScissorsIcon} label="Too close to edge" value={drop.edge} tone="muted" sub="window runs off the recording" />
  const sub = parts.filter(([k]) => k).map(([k, what]) => `${k} ${what}`).join(' · ')
  return <Stat icon={ScissorsIcon} label="Not cut" value={total} tone="muted" sub={sub} />
}

export function EpochingPanel() {
  const dataset = useAppStore((s) => s.dataset!)
  const p = useAppStore((s) => s.params!)
  const setParams = useAppStore((s) => s.setParams)
  const { data } = useProcess()
  const lowPass = lowPassOptions(dataset.summary.sfreq)
  const lpIndex = p.h_freq ? nearest(lowPass.slice(0, -1), p.h_freq) : lowPass.length - 1
  const rejectedShare = data ? data.drop.rejected / Math.max(1, data.drop.rejected + data.drop.kept) : 0

  return (
    <div className="space-y-6">

      <PanelSection title="Epoch">
        <RangeControl
          id="epoch" label="Epoch window" value={[p.tmin, p.tmax]} min={-1} max={2} step={0.05} format={fmt.ms} minGap={0.3}
          help="How much signal to cut out around each event: from tmin before it to tmax after it."
          onChange={([a, b]) => setParams(withEpochWindow(p, Math.min(a, 0), Math.max(b, 0.1)))}
        />
        <SwitchControl
          id="baseline" label="Baseline correction" checked={p.baseline}
          help="Subtract each epoch's average voltage in the baseline window, so all epochs start from the same level."
          onChange={(baseline) => setParams({ baseline })}
        />
        {p.baseline && (
          <RangeControl
            id="baseline-window" label="Baseline window" value={[p.baseline_start, p.baseline_end]}
            min={p.tmin} max={Math.min(p.tmax, 0.5)} step={0.01} format={fmt.ms} minGap={0.02}
            help="Usually the period just before the event, when nothing task-related should be happening."
            onChange={([baseline_start, baseline_end]) => setParams({ baseline_start, baseline_end })}
          />
        )}
        {p.baseline && p.baseline_end > 0 && (
          <Nudge>The baseline now includes time after the event, so part of the response itself is being subtracted.</Nudge>
        )}
      </PanelSection>

      <PanelSection title="Filter and reference">
        <ParamControl
          id="hp" label="High-pass" value={nearest(HIGH_PASS, p.l_freq || 0)} min={0} max={HIGH_PASS.length - 1} step={1}
          format={(i) => fmt.hz(HIGH_PASS[i])}
          help="Removes slow drifts below this frequency. Too high a cut-off also removes slow ERP components such as the P300."
          onChange={(i) => setParams({ l_freq: HIGH_PASS[i] })}
        />
        <ParamControl
          id="lp" label="Low-pass" value={lpIndex} min={0} max={lowPass.length - 1} step={1}
          format={(i) => fmt.hz(lowPass[i])}
          help="Removes fast activity (muscle, line noise) above this frequency. 30 Hz is common for ERPs."
          onChange={(i) => setParams({ h_freq: lowPass[i] })}
        />
        {p.l_freq > 1 && <Nudge>A high-pass above 1 Hz removes slow activity: slow components (P3, ERN) shrink and change shape. Pin the ERP first to compare.</Nudge>}
        <SelectControl
          id="reference" label="Reference" value={p.reference}
          options={[
            { value: 'average', label: 'Average of all channels' },
            { value: 'none', label: 'Recording reference (unchanged)' },
            ...dataset.summary.ch_names.map((c) => ({ value: c, label: `Channel ${c}` })),
          ]}
          help="Voltages are always measured against a reference. Changing it changes the amplitude at every electrode."
          onChange={(reference) => setParams({ reference })}
        />
      </PanelSection>

      <PanelSection title="Artefact rejection">
        <ParamControl
          id="reject" label="Peak-to-peak threshold" value={p.reject_uv || 0} min={0} max={300} step={5} format={fmt.uv}
          help="Drop any epoch whose largest swing (max − min) on any channel exceeds this. 0 turns rejection off."
          onChange={(reject_uv) => setParams({ reject_uv })}
        />
        {rejectedShare > 0.5 && <Nudge>More than half the epochs are rejected. Is the threshold too strict?</Nudge>}
      </PanelSection>

      <PanelSection title="Display">
        <ChannelSelect />
      </PanelSection>
    </div>
  )
}

export function EpochingMain() {
  const { data, isFetching, error } = useProcess()
  const setStep = useAppStore((s) => s.setStep)
  useKeptToast(data?.drop.kept)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <StepHeader
        id="epoching"
        title="Cut the signal into epochs"
        text="An epoch is a short window of EEG around one event. Set the window, filter and rejection threshold on the left; the plots update as you move the sliders."
        aside={<ProcessStatus isFetching={isFetching} error={error} />}
      />
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
            <Stat icon={CheckCircle2Icon} label="Epochs kept" value={`${data.drop.kept} / ${data.drop.total_events}`} sub="go into the averages" tone="good" />
            <Stat icon={XCircleIcon} label="Rejected" value={data.drop.rejected} tone={data.drop.rejected ? 'bad' : 'muted'} sub="swing above the threshold" />
            <NotCutStat drop={data.drop} />
            <Stat
              icon={TagsIcon}
              label="Kept per condition"
              value={<span className="text-xl">{data.conditions.map((c) => `${c.n_kept}`).join(' / ')}</span>}
              sub={data.conditions.map((c) => c.name).join(' / ')}
            />
          </div>
          <RawPlot result={data} />
          <div className="grid gap-6 @4xl:grid-cols-[3fr_2fr]">
            <ErpImagePlot result={data} />
            <DropLogChart result={data} />
          </div>
          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStep('erp')}>
              Continue to ERP <ArrowRightIcon />
            </Button>
          </div>
        </>
      ) : (
        !error && <div role="status" className="bg-muted h-96 animate-pulse rounded-[20px]"><span className="sr-only">Loading epochs…</span></div>
      )}
    </div>
  )
}
