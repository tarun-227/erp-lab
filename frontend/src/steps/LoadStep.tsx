import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ActivityIcon,
  ArrowRightIcon,
  AudioWaveformIcon,
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
import { formatDuration } from '@/lib/steps'
import type { LoadResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { type LoadSource, useAppStore } from '@/store/useAppStore'
import { StepHeader } from './StepHeader'

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
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 60_000 })
  const load = useMutation({
    mutationFn: api.loadSample,
    onSuccess: onLoaded,
    onError: (err) => toast.error('Could not load the sample', { description: err.message }),
  })
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">ERP CORE: flanker task</h2>
      <p className="text-muted-foreground text-xs leading-relaxed">
        One participant from ERP CORE (Kappenman et al., 2021, NeuroImage). A central arrow points left or right and is
        flanked by arrows pointing the same way (compatible) or the other way (incompatible). The participant presses the
        button for the central arrow; some presses are errors.
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs leading-relaxed">
        <li><b className="text-foreground">ERN</b>: a negative wave at FCz right after error responses.</li>
        <li><b className="text-foreground">P3</b>: a positive wave at Pz after the stimulus.</li>
      </ul>
      <Button className="w-full" disabled={load.isPending || health?.real_sample === false} onClick={() => load.mutate()}>
        {load.isPending ? <Loader2Icon className="animate-spin" /> : <DatabaseIcon />} Load sample recording
      </Button>
      {health?.real_sample === false && (
        <p className="text-destructive text-xs">The sample file is missing. Run <code>python scripts/make_sample_data.py</code>.</p>
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
      <h2 className="text-sm font-semibold">Your own recording</h2>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
      >
        <FileUpIcon className="text-muted-foreground mb-2 size-6" />
        <span className="text-sm font-medium">Drop files or click to choose</span>
        <span className="text-muted-foreground mt-1 text-xs">.fif, .edf, .bdf, .set (+ .fdt), .vhdr (+ .eeg, .vmrk)</span>
      </div>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {files.map((f) => (
            <li key={f.name} className="flex justify-between gap-2"><span className="truncate">{f.name}</span><span>{(f.size / 1e6).toFixed(1)} MB</span></li>
          ))}
        </ul>
      )}
      <Button className="w-full" disabled={!files.length || upload.isPending} onClick={() => upload.mutate(files)}>
        {upload.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Upload and load
      </Button>
      <p className="text-muted-foreground text-xs leading-relaxed">
        The file needs a stim channel or annotations for events. Recordings longer than 20 minutes are trimmed and fast ones are resampled to 250 Hz. Files stay in memory on this server only.
      </p>
    </div>
  )
}

export function LoadPanel() {
  const source = useAppStore((s) => s.loadSource)
  return source === 'upload' ? <UploadPanel /> : <SamplePanel />
}

const SOURCES: { id: LoadSource; icon: typeof DatabaseIcon; title: string; text: string }[] = [
  { id: 'sample', icon: DatabaseIcon, title: 'Sample recording', text: 'A flanker task from ERP CORE, with correct and error responses.' },
  { id: 'upload', icon: UploadIcon, title: 'Your own file', text: 'Upload .fif, .edf, .bdf, .set or BrainVision files.' },
]

export function LoadMain() {
  const dataset = useAppStore((s) => s.dataset)
  const source = useAppStore((s) => s.loadSource)
  const setSource = useAppStore((s) => s.setLoadSource)
  const setStep = useAppStore((s) => s.setStep)
  const dark = useTheme().resolvedTheme === 'dark'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <StepHeader
        step={1}
        title="Load a recording"
        text="Every ERP analysis starts from continuous EEG plus a list of events. Start with the sample recording, or upload your own."
      />

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Data source">
        {SOURCES.map(({ id, icon: Icon, title, text }) => {
          const active = source === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSource(id)}
              className={cn('relative rounded-xl border p-4 text-left transition-shadow hover:shadow-sm', active && 'ring-primary/60 bg-primary/5 ring-2')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('flex size-9 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <Icon className="size-4.5" />
                </span>
                {dataset?.source === id && <Badge variant="secondary">Loaded</Badge>}
              </div>
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{text}</p>
            </button>
          )
        })}
      </div>

      {dataset ? (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={ActivityIcon} label="Channels" value={String(dataset.summary.n_channels)} />
            <Stat icon={WavesIcon} label="Sampling rate" value={`${dataset.summary.sfreq} Hz`} />
            <Stat icon={ClockIcon} label="Duration" value={formatDuration(dataset.summary.duration_s)} />
            <Stat icon={ZapIcon} label="Events" value={String(dataset.summary.n_events)} />
          </div>

          <div className="rounded-xl border p-4">
            {dataset.description && <p className="text-muted-foreground mb-4 text-sm">{dataset.description}</p>}
            <h3 className="text-sm font-semibold">Events found</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(dataset.summary.event_counts).map(([code, count], i) => (
                <span key={code} className="bg-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: conditionColor(i, dark) }} />
                  <span className="font-medium">{dataset.suggested_event_names[code] ?? `Code ${code}`}</span>
                  <span className="text-muted-foreground font-mono text-xs">code {code} · {count}×</span>
                </span>
              ))}
            </div>
            <h3 className="mt-5 text-sm font-semibold">Channels</h3>
            <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed">{dataset.summary.ch_names.join('  ')}</p>
            {!dataset.has_positions && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
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
      ) : (
        <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <AudioWaveformIcon className="mb-3 size-8" />
          <p className="text-foreground text-sm font-medium">No recording yet</p>
          <p className="mt-1 text-sm">Load the sample recording or upload a file from the panel on the left.</p>
        </div>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof ActivityIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
