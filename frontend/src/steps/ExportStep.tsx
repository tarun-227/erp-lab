import { useQuery } from '@tanstack/react-query'
import { CopyIcon, DownloadIcon, FileCodeIcon, FileJsonIcon, Link2Icon, TableIcon, UploadIcon, WavesIcon } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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

function ExportCard({ icon: Icon, title, text, children }: { icon: typeof FileCodeIcon; title: string; text: string; children: ReactNode }) {
  return (
    <div className="bg-card shadow-soft flex flex-col rounded-[20px] border p-5">
      <div className="flex items-center gap-3">
        <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-2xl"><Icon className="size-5" aria-hidden /></span>
        <h2 className="text-lg font-extrabold">{title}</h2>
      </div>
      <p className="text-muted-foreground mt-3 flex-1 text-[15px] leading-snug">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
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
    enabled: !paramsProblem(debounced, dataset.summary.sfreq),
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
      toast.success('Parameters restored', { description: 'Undo is in the Quick start panel on the Events step.' })
    } catch (err) {
      toast.error('Could not load parameters', { description: (err as Error).message })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <StepHeader
        id="export"
        title="Take the pipeline with you"
        text="Everything you set up here can be reproduced outside the app: a Python script with your exact parameters, the recording it runs on, and the results."
      />

      <div className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
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

      <section className="bg-card shadow-soft overflow-hidden rounded-[20px] border" aria-labelledby="script-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <FileCodeIcon className="text-primary size-5" aria-hidden />
            <h2 id="script-title" className="font-mono text-base font-medium">erp_pipeline.py</h2>
            <span className="text-muted-foreground text-sm">Run with <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[13px]">python erp_pipeline.py recording_raw.fif</code></span>
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
        <pre tabIndex={0} role="region" aria-label="Generated Python script" className="bg-muted/40 max-h-[560px] overflow-auto p-5 font-mono text-[13px] leading-relaxed">
          {exported ? highlight(exported.script) : error ? (error as Error).message : paramsProblem(debounced, dataset.summary.sfreq) ?? 'Generating…'}
        </pre>
      </section>
    </div>
  )
}
