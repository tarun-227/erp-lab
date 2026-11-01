import { useQuery } from '@tanstack/react-query'
import { CopyIcon, DownloadIcon, FileCodeIcon, FileJsonIcon, Link2Icon, TableIcon, UploadIcon, WavesIcon } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fmt } from '@/components/ParamControl'
import { useErpWaves } from '@/hooks/useErp'
import { useDebounced, useProcess } from '@/hooks/useProcess'
import { api } from '@/lib/api'
import { paramsProblem } from '@/lib/presets'
import { downloadText, isParams, shareUrl } from '@/lib/share'
import { useAppStore } from '@/store/useAppStore'
import { StepHeader } from './StepHeader'

/** Minimal Python highlighting: comments, strings and keywords. */
function highlight(code: string): ReactNode[] {
  const pattern = /(#[^\n]*)|("""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(import|from|for|in|if|not|and|print|def|return|None|True|False)\b/g
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    const cls = m[1] ? 'text-muted-foreground italic' : m[2] ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary font-medium'
    out.push(<span key={m.index} className={cls}>{m[0]}</span>)
    last = m.index + m[0].length
  }
  out.push(code.slice(last))
  return out
}

export function ExportPanel() {
  const p = useAppStore((s) => s.params!)
  const rows: [string, string][] = [
    ['Conditions', p.conditions.map((c) => `${c.name} (${c.code})`).join(', ')],
    ['Filter', `${fmt.hz(p.l_freq)} – ${fmt.hz(p.h_freq)}`],
    ['Reference', p.reference],
    ['Epoch', `${fmt.ms(p.tmin)} → ${fmt.ms(p.tmax)}`],
    ['Baseline', p.baseline ? `${fmt.ms(p.baseline_start)} → ${fmt.ms(p.baseline_end)}` : 'off'],
    ['Rejection', fmt.uv(p.reject_uv)],
    ['Channel', p.channel],
    ['Peak window', `${fmt.ms(p.peak_start)} → ${fmt.ms(p.peak_end)} (${p.polarity})`],
  ]
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Current parameters</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="font-mono text-xs break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ExportCard({ icon: Icon, title, text, children }: { icon: typeof FileCodeIcon; title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg"><Icon className="size-4" /></span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-muted-foreground mt-2 flex-1 text-xs leading-relaxed">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function ExportMain() {
  const dataset = useAppStore((s) => s.dataset!)
  const params = useAppStore((s) => s.params!)
  const replaceParams = useAppStore((s) => s.replaceParams)
  const debounced = useDebounced(params, 300)
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: result } = useProcess()
  const erp = useErpWaves(result)

  const { data: exported, error } = useQuery({
    queryKey: ['export', dataset.session_id, debounced],
    queryFn: () => api.export(dataset.session_id, debounced),
    enabled: !paramsProblem(debounced),
    staleTime: Infinity,
  })

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error('Copy failed: your browser blocked clipboard access')
    }
  }

  const downloadCsv = () => {
    if (!result || !erp) return
    const cols = [...erp.waves.filter((w) => w.n), ...(erp.difference ? [erp.difference] : [])]
    const header = ['time_s', ...cols.map((w) => `${w.name.replace(/[",]/g, ' ')}_uV`)].join(',')
    const lines = result.times.map((t, i) => [t, ...cols.map((w) => w.mean[i].toFixed(3))].join(','))
    downloadText(`erp_${result.channel}.csv`, [header, ...lines].join('\n'), 'text/csv')
  }

  const loadJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const candidate = isParams(parsed?.params) ? parsed.params : parsed
      if (!isParams(candidate)) throw new Error('This is not an ERP Lab parameters file.')
      const missing = candidate.conditions.filter((c) => !(String(c.code) in dataset.summary.event_counts))
      if (missing.length) throw new Error(`This recording has no events with code ${missing.map((c) => c.code).join(', ')}.`)
      replaceParams(candidate)
      toast.success('Parameters restored', { description: 'Undo is available in the Presets panel.' })
    } catch (err) {
      toast.error('Could not load parameters', { description: (err as Error).message })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <StepHeader
        step={6}
        title="Take the pipeline with you"
        text="Everything you set up here can be reproduced outside the app: a Python script with your exact parameters, the recording it runs on, and the results."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExportCard icon={WavesIcon} title="Recording" text="The EEG and events this script runs on, as an MNE .fif file.">
          <Button size="sm" variant="outline" nativeButton={false} render={<a href={api.recordingUrl(dataset.session_id)} download="recording_raw.fif" />}>
            <DownloadIcon /> recording_raw.fif
          </Button>
        </ExportCard>
        <ExportCard icon={FileJsonIcon} title="Parameters" text="Save your settings as JSON, or load a saved file to restore them.">
          <Button size="sm" variant="outline" onClick={() => downloadText('erp_params.json', JSON.stringify({ params }, null, 2), 'application/json')}>
            <DownloadIcon /> Save JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon /> Load JSON
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && loadJson(e.target.files[0])} />
        </ExportCard>
        <ExportCard icon={Link2Icon} title="Share link" text="A link that opens the app with these settings (parameters only, no data).">
          <Button size="sm" variant="outline" onClick={() => copy(shareUrl(params), 'Link')}>
            <CopyIcon /> Copy link
          </Button>
        </ExportCard>
        <ExportCard icon={TableIcon} title="Results" text="ERP waveforms at the current channel as CSV. Each plot's camera icon saves it as a PNG.">
          <Button size="sm" variant="outline" disabled={!erp} onClick={downloadCsv}>
            <DownloadIcon /> ERP as CSV
          </Button>
        </ExportCard>
      </div>

      <section className="bg-card rounded-xl border">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <FileCodeIcon className="text-primary size-4" />
            <h3 className="text-sm font-semibold">erp_pipeline.py</h3>
            <span className="text-muted-foreground text-xs">Run with: python erp_pipeline.py recording_raw.fif</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!exported} onClick={() => exported && copy(exported.script, 'Script')}>
              <CopyIcon /> Copy
            </Button>
            <Button size="sm" disabled={!exported} onClick={() => exported && downloadText('erp_pipeline.py', exported.script, 'text/x-python')}>
              <DownloadIcon /> Download
            </Button>
          </div>
        </header>
        <pre className="max-h-[560px] overflow-auto p-4 font-mono text-xs leading-relaxed">
          {exported ? highlight(exported.script) : error ? (error as Error).message : paramsProblem(debounced) ?? 'Generating…'}
        </pre>
      </section>
    </div>
  )
}
