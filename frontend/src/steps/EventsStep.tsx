import type * as P from 'plotly.js'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { PlotCard } from '@/components/PlotCard'
import { PresetPicker } from '@/components/PresetPicker'
import { PanelSection } from '@/components/ParamControl'
import { usePlotTheme } from '@/hooks/usePlotTheme'
import { api } from '@/lib/api'
import { conditionColor } from '@/lib/colors'
import { PlotlyChart, baseLayout } from '@/plots/PlotlyChart'
import { useAppStore } from '@/store/useAppStore'
import { StepHeader } from './StepHeader'

const MAX_CONDITIONS = 6

export function EventsPanel() {
  const dataset = useAppStore((s) => s.dataset!)
  const params = useAppStore((s) => s.params!)
  const setParams = useAppStore((s) => s.setParams)
  const theme = usePlotTheme()
  const codes = Object.keys(dataset.summary.event_counts).map(Number)
  const included = new Map(params.conditions.map((c, i) => [c.code, i]))

  const toggle = (code: number) => {
    if (included.has(code)) {
      if (params.conditions.length > 1) setParams({ conditions: params.conditions.filter((c) => c.code !== code) })
    } else if (params.conditions.length < MAX_CONDITIONS) {
      let name = dataset.suggested_event_names[String(code)] ?? `Code ${code}`
      if (params.conditions.some((c) => c.name === name)) name = `${name} (${code})`
      setParams({ conditions: [...params.conditions, { code, name }] })
    }
  }
  const rename = (code: number, name: string) =>
    setParams({ conditions: params.conditions.map((c) => (c.code === code ? { ...c, name } : c)) })
  const duplicate = new Set(params.conditions.map((c) => c.name.trim()).filter((n, i, all) => !n || all.indexOf(n) !== i))

  return (
    <div className="space-y-6">
      <PresetPicker />
      <PanelSection title="Conditions">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tick the event codes to analyse and give each a name. Each ticked code becomes one ERP. Up to {MAX_CONDITIONS}.
        </p>
        <ul className="space-y-2.5">
          {codes.map((code) => {
            const idx = included.get(code)
            const cond = idx !== undefined ? params.conditions[idx] : null
            return (
              <li key={code} className="bg-muted/60 flex items-center gap-2.5 rounded-xl p-2">
                <input
                  type="checkbox"
                  aria-label={`Include code ${code}`}
                  checked={cond !== null}
                  onChange={() => toggle(code)}
                  className="accent-primary size-5 shrink-0"
                />
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: idx !== undefined ? conditionColor(idx, theme.dark) : 'transparent', border: '1px solid var(--border)' }}
                />
                {cond ? (
                  <input
                    aria-label={`Name for code ${code}`}
                    value={cond.name}
                    maxLength={60}
                    onChange={(e) => rename(code, e.target.value)}
                    aria-invalid={duplicate.has(cond.name.trim()) || undefined}
                    aria-describedby={duplicate.has(cond.name.trim()) ? 'names-error' : undefined}
                    className={`bg-card h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-[15px] ${duplicate.has(cond.name.trim()) ? 'border-destructive' : 'border-input'}`}
                  />
                ) : (
                  <span className="text-muted-foreground flex-1 truncate text-[15px]">{dataset.suggested_event_names[String(code)] ?? `Code ${code}`}</span>
                )}
                <span className="text-muted-foreground w-16 shrink-0 text-right font-mono text-[13px]">
                  {code} · {dataset.summary.event_counts[String(code)]}×
                </span>
              </li>
            )
          })}
        </ul>
        {duplicate.size > 0 && (
          <p id="names-error" role="alert" className="text-destructive text-sm">
            Two conditions share a name, or one is empty. Give each a unique name.
          </p>
        )}
      </PanelSection>
    </div>
  )
}

export function EventsMain() {
  const dataset = useAppStore((s) => s.dataset!)
  const params = useAppStore((s) => s.params!)
  const setStep = useAppStore((s) => s.setStep)
  const theme = usePlotTheme()
  const { data: events } = useQuery({
    queryKey: ['events', dataset.session_id],
    queryFn: () => api.events(dataset.session_id),
    staleTime: Infinity,
  })

  const figure = useMemo(() => {
    if (!events) return null
    const codes = Object.keys(dataset.summary.event_counts).map(Number)
    const index = new Map(params.conditions.map((c, i) => [c.code, i]))
    const label = (code: number) => params.conditions.find((c) => c.code === code)?.name ?? dataset.suggested_event_names[String(code)] ?? `Code ${code}`
    const traces: P.Data[] = codes.map((code) => {
      const times = events.times_s.filter((_, i) => events.codes[i] === code)
      const idx = index.get(code)
      return {
        type: 'scattergl', mode: 'markers', x: times, y: times.map(() => label(code)), name: label(code),
        marker: { symbol: 'line-ns-open', size: 14, line: { width: 1.5 }, color: idx !== undefined ? conditionColor(idx, theme.dark) : theme.muted, opacity: idx !== undefined ? 1 : 0.35 },
        hovertemplate: `${label(code)} (code ${code}) at %{x:.2f} s<extra></extra>`,
      }
    })
    return {
      traces,
      layout: baseLayout(theme, {
        showlegend: false, margin: { l: 120, r: 16, t: 8, b: 40 },
        xaxis: { title: { text: 'Time in recording (s)' }, rangeslider: { visible: true, thickness: 0.08 } },
        yaxis: { type: 'category', fixedrange: true },
      }),
      height: 180 + codes.length * 44,
    }
  }, [events, dataset, params.conditions, theme])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <StepHeader
        id="events"
        title="Events and conditions"
        text="Each event marks a stimulus or response. Its code says which condition it belongs to. Choose which codes to analyse and name them; the next steps average each condition separately."
      />
      <PlotCard
        id="events"
        title="Event timeline"
        subtitle="Every event in the recording. Drag the slider under the plot to zoom in."
        help="One tick per event. Faded rows are codes you have not included. Rare events (like targets) give fewer trials, so their average will be noisier."
      >
        {figure ? (
          <PlotlyChart id="events" label="Event timeline" data={figure.traces} layout={figure.layout} height={figure.height} />
        ) : (
          <div className="bg-muted h-48 animate-pulse rounded-2xl" />
        )}
      </PlotCard>
      <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
        {params.conditions.map((c, i) => (
          <div key={c.code} className="bg-card shadow-soft rounded-2xl border p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-full" style={{ background: conditionColor(i, theme.dark) }} />
              <span className="truncate font-medium">{c.name}</span>
            </div>
            <div className="font-heading mt-1 text-[28px] leading-9 font-extrabold tabular">{dataset.summary.event_counts[String(c.code)] ?? 0}</div>
            <div className="text-muted-foreground text-sm">events with code {c.code}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="lg" onClick={() => setStep('epoching')}>
          Continue to Epoching <ArrowRightIcon />
        </Button>
      </div>
    </div>
  )
}
