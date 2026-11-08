import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockIcon,
  DatabaseIcon,
  FileUpIcon,
  Loader2Icon,
  UploadIcon,
  WavesIcon,
  ZapIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { type DragEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { conditionColor } from '@/lib/colors'
import { SAMPLES, type SampleId } from '@/lib/samples'
import { formatDuration } from '@/lib/steps'
import type { LoadResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { type LoadSource, useAppStore } from '@/store/useAppStore'
import { Stat, StepHeader } from './StepHeader'

const ACCEPT = '.fif,.gz,.edf,.bdf,.set,.fdt,.vhdr,.vmrk,.eeg,.gdf,.cnt'

function useLoaded() {
  const setDataset = useAppStore((s) => s.setDataset)
  return (data: LoadResponse) => {
    setDataset(data)
    toast.success(`Loaded ${data.summary.n_events} events`, {
      description: `${data.summary.n_channels} channels, ${formatDuration(data.summary.duration_s)} at ${data.summary.sfreq} Hz`,
    })
  }
}

function SamplePanel() {
  const onLoaded = useLoaded()
  const selected = useAppStore((s) => s.sampleId)
  const setSelected = useAppStore((s) => s.setSampleId)
  const loaded = useAppStore((s) => s.dataset?.sample_id)
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 60_000 })
  const load = useMutation({
    mutationFn: (id: SampleId) => api.loadSample(id),
    onSuccess: onLoaded,
    onError: (err) => toast.error('Could not load the sample', { description: err.message }),
  })
  const sample = SAMPLES.find((x) => x.id === selected) ?? SAMPLES[0]
  const missing = health?.samples?.[sample.id] === false
  return (
    <div className="space-y-4">
      <h2 id="sample-title" className="text-lg font-extrabold">Choose an experiment</h2>
      <div role="radiogroup" aria-labelledby="sample-title" className="space-y-2">
        {SAMPLES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={x.id === sample.id}
            onClick={() => setSelected(x.id)}
            className={cn(
              'w-full rounded-xl border-2 px-3 py-2 text-left transition-colors duration-200',
              x.id === sample.id ? 'border-primary bg-primary-soft' : 'border-input hover:border-primary/40',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{x.title}</span>
              {loaded === x.id && <Badge className="bg-success-soft text-success">Loaded</Badge>}
            </span>
            <span className="text-muted-foreground block text-sm">{x.kind}</span>
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-[15px] leading-relaxed">{sample.text}</p>
      <ul className="space-y-2 text-[15px] leading-snug">
        {sample.lookFor.map((item) => (
          <li key={item.name} className="bg-primary-soft rounded-xl px-3 py-2"><b>{item.name}</b>: {item.what}</li>
        ))}
      </ul>
      <Button size="lg" className="w-full" disabled={load.isPending || missing} onClick={() => load.mutate(sample.id)}>
        {load.isPending ? <Loader2Icon className="animate-spin" /> : <DatabaseIcon />} Load sample recording
      </Button>
      {missing && (
        <p role="alert" className="text-destructive text-sm">This sample file is missing. Run <code>python scripts/make_sample_data.py {sample.id}</code>.</p>
      )}
    </div>
  )
}

function UploadPanel() {
  const onLoaded = useLoaded()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const upload = useMutation({
    mutationFn: (f: File[]) => api.upload(f),
    onSuccess: onLoaded,
    onError: (err) => toast.error('Upload failed', { description: err.message }),
  })
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    setFiles(Array.from(e.dataTransfer.files))
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold">Your own recording</h2>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose EEG files to upload"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors duration-200',
          dragging ? 'border-primary bg-primary-soft' : 'border-input hover:border-primary/50 hover:bg-primary-soft',
        )}
      >
        <FileUpIcon className="text-primary mb-2 size-7" aria-hidden />
        <span className="text-[15px] font-semibold">Drop files or click to choose</span>
        <span className="text-muted-foreground mt-1 text-sm">.fif, .edf, .bdf, .set (+ .fdt), .vhdr (+ .eeg, .vmrk)</span>
      </div>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-sm">
          {files.map((f) => (
            <li key={f.name} className="flex justify-between gap-2">
              <span className="truncate" title={f.name}>{f.name}</span>
              <span className="tabular">{(f.size / 1e6).toFixed(1)} MB</span>
            </li>
          ))}
        </ul>
      )}
      <Button size="lg" className="w-full" disabled={!files.length || upload.isPending} onClick={() => upload.mutate(files)}>
        {upload.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Upload and load
      </Button>
      <p className="text-muted-foreground text-sm leading-relaxed">
        The file needs a stim channel or annotations for events. Recordings longer than 20 minutes are trimmed and fast ones are
        resampled to 250 Hz. Files stay in memory on this server only.
      </p>
    </div>
  )
}

export function LoadPanel() {
  const source = useAppStore((s) => s.loadSource)
  return source === 'upload' ? <UploadPanel /> : <SamplePanel />
}

const SOURCES: { id: LoadSource; icon: typeof DatabaseIcon; title: string; text: string }[] = [
  { id: 'sample', icon: DatabaseIcon, title: 'Sample recording', text: 'Three real experiments: a flanker task, an auditory oddball and flickering light. Best place to start.' },
  { id: 'upload', icon: UploadIcon, title: 'Your own file', text: 'Upload .fif, .edf, .bdf, .set or BrainVision files with event markers.' },
]

/** The idea of the whole module in one picture: noisy EEG, cut around events, averaged. */
function JourneyDiagram() {
  const wave = (seed: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const noise = Math.sin(i * 1.7 + seed) * 5 + Math.sin(i * 0.6 + seed * 2) * 3
      const erp = -14 * Math.exp(-((i - 22) ** 2) / 10)
      return `${i * 3},${20 + noise + erp * 0.35}`
    }).join(' ')
  const average = Array.from({ length: 41 }, (_, i) => `${i * 3},${20 - 14 * Math.exp(-((i - 22) ** 2) / 10)}`).join(' ')
  const stages = [
    { label: 'Continuous EEG', sub: 'with event markers' },
    { label: 'Cut into epochs', sub: 'one window per event' },
    { label: 'Average', sub: 'and the ERP appears' },
  ]
  return (
    <figure
      className="grid gap-4 @xl:grid-cols-3"
      aria-label="How an ERP is made: continuous EEG is cut into epochs around events, and the epochs are averaged"
    >
      {stages.map((st, k) => (
        <div key={st.label} className="bg-card shadow-soft rounded-[20px] border p-4">
          <svg viewBox="-4 -6 128 48" className="h-16 w-full" aria-hidden>
            {k === 0 && (
              <>
                <polyline points={wave(1)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinejoin="round" />
                {[18, 66, 108].map((x) => (
                  <line key={x} x1={x} x2={x} y1={-4} y2={40} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" />
                ))}
              </>
            )}
            {k === 1 &&
              [0, 1, 2].map((r) => (
                <polyline
                  key={r}
                  points={wave(r + 2)}
                  transform={`translate(0 ${(r - 1) * 11}) scale(1 0.55) translate(0 16)`}
                  fill="none"
                  stroke="var(--cond-1)"
                  strokeOpacity={0.45 + r * 0.25}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              ))}
            {k === 2 && <polyline points={average} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <figcaption className="mt-2">
            <span className="bg-primary-soft text-primary mr-2 inline-flex size-6 items-center justify-center rounded-full font-mono text-[13px]">{k + 1}</span>
            <span className="font-heading font-extrabold">{st.label}</span>
            <span className="text-muted-foreground mt-0.5 block text-sm">{st.sub}</span>
          </figcaption>
        </div>
      ))}
    </figure>
  )
}

export function LoadMain() {
  const dataset = useAppStore((s) => s.dataset)
  const source = useAppStore((s) => s.loadSource)
  const setSource = useAppStore((s) => s.setLoadSource)
  const setStep = useAppStore((s) => s.setStep)
  const dark = useTheme().resolvedTheme === 'dark'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <StepHeader
        id="load"
        title="Welcome! Let's find a brain response"
        text="An event-related potential (ERP) is a tiny voltage change the brain makes after an event, hidden in much larger EEG. In six short steps you'll dig it out yourself."
      />

      {!dataset && <JourneyDiagram />}

      <section aria-labelledby="source-title" className="space-y-3">
        <h2 id="source-title" className="text-lg font-extrabold">Choose your data</h2>
        <div className="grid gap-4 @xl:grid-cols-2" role="radiogroup" aria-labelledby="source-title">
          {SOURCES.map(({ id, icon: Icon, title, text }) => {
            const active = source === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSource(id)}
                className={cn(
                  'bg-card relative rounded-[20px] border-2 p-5 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99]',
                  active ? 'border-primary shadow-clay' : 'shadow-soft hover:border-primary/40 border-transparent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('flex size-12 items-center justify-center rounded-2xl', active ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary')}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {dataset?.source === id ? (
                    <Badge className="bg-success-soft text-success">Loaded</Badge>
                  ) : active ? (
                    <Badge variant="secondary">Selected</Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
                <p className="text-muted-foreground mt-1 text-[15px] leading-snug">{text}</p>
              </button>
            )
          })}
        </div>
        {!dataset && (
          <p className="text-muted-foreground flex items-center gap-2 text-[15px]">
            <ArrowLeftIcon className="text-primary size-4 shrink-0" aria-hidden />
            Then press the load button in the panel on the left.
          </p>
        )}
      </section>

      {dataset && (
        <section className="space-y-5" aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-lg font-extrabold">What's in this recording</h2>
          <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
            <Stat icon={ActivityIcon} label="Channels" value={String(dataset.summary.n_channels)} sub="electrodes on the scalp" />
            <Stat icon={WavesIcon} label="Sampling rate" value={`${dataset.summary.sfreq} Hz`} sub="samples per second" />
            <Stat icon={ClockIcon} label="Duration" value={formatDuration(dataset.summary.duration_s)} />
            <Stat icon={ZapIcon} label="Events" value={String(dataset.summary.n_events)} sub="moments to cut around" />
          </div>

          <div className="bg-card shadow-soft space-y-5 rounded-[20px] border p-5">
            {dataset.description && <p className="text-[15px] leading-relaxed">{dataset.description}</p>}
            <div>
              <h3 className="font-heading font-extrabold">Events found</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(dataset.summary.event_counts).map(([code, count], i) => (
                  <span key={code} className="bg-muted inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px]">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: conditionColor(i, dark) }} />
                    <span className="font-medium">{dataset.suggested_event_names[code] ?? `Code ${code}`}</span>
                    <span className="text-muted-foreground font-mono text-[13px]">code {code} · {count}×</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-heading font-extrabold">Channels</h3>
              <p className="text-muted-foreground mt-2 font-mono text-[13px] leading-relaxed">{dataset.summary.ch_names.join('  ')}</p>
            </div>
            {!dataset.has_positions && (
              <p role="note" className="bg-warning-soft text-warning rounded-xl px-3 py-2.5 text-sm">
                No electrode positions were found for these channel names, so the scalp map will be unavailable.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStep('events')}>
              Continue to Events <ArrowRightIcon />
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
