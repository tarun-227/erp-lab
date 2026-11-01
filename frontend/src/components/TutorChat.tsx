import {
  ArrowRightIcon,
  CheckIcon,
  ImageIcon,
  Loader2Icon,
  SendHorizonalIcon,
  SparklesIcon,
  Trash2Icon,
  Undo2Icon,
  WifiOffIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTutor, useTutorStatus } from '@/hooks/useTutor'
import { STEPS, type StepId } from '@/lib/steps'
import { cn } from '@/lib/utils'
import { type TutorAction, type TutorMessage, useAppStore } from '@/store/useAppStore'

const SUGGESTIONS: Record<StepId, string[]> = {
  load: ['What is an ERP, in one paragraph?', 'What happens in the flanker task?'],
  events: ['Why do rare targets give a noisier average?', 'Which conditions should I compare?'],
  epoching: ['Why were these epochs rejected?', 'Is my rejection threshold sensible?', 'What does the high-pass filter do here?'],
  erp: ['Is my ERN real or noise?', 'Why is the difference wave largest there?', 'How many trials do I really need?'],
  learn: ['Quiz me on baseline correction', 'Explain 1/√N with my numbers'],
  export: ['What does each line of the script do?', 'How would I report these results?'],
}

function changeLabel(changes: TutorAction['changes']): string {
  return Object.entries(changes)
    .map(([k, v]) => `${k} = ${v}`)
    .join(', ')
}

function MessageView({ m }: { m: TutorMessage }) {
  const { applyAction, undoAction } = useTutor()
  const setStep = useAppStore((s) => s.setStep)
  if (m.role === 'user') {
    return (
      <div className="bg-primary text-primary-foreground ml-8 rounded-2xl rounded-br-sm px-3 py-2 text-sm">
        {m.plot && (
          <div className="mb-1 flex items-center gap-1 text-xs opacity-80">
            <ImageIcon className="size-3" /> {m.plot} plot attached
          </div>
        )}
        {m.content}
      </div>
    )
  }
  return (
    <div className="mr-4 space-y-2">
      {(m.content || m.streaming) && (
        <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
          {m.content}
          {m.streaming && <span className="bg-foreground/60 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />}
        </div>
      )}
      {m.error && (
        <div className={cn('rounded-lg px-3 py-2 text-sm', m.error.kind === 'busy' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-destructive/10 text-destructive')}>
          {m.error.message}
        </div>
      )}
      {m.actions?.map((a) => (
        <div key={a.id} className="border-primary/30 bg-primary/5 rounded-xl border p-3">
          <div className="text-primary flex items-center gap-1.5 text-xs font-semibold">
            <SparklesIcon className="size-3.5" /> Suggested experiment
          </div>
          <div className="mt-1 text-sm font-medium">{a.title}</div>
          <div className="text-muted-foreground font-mono text-xs">{changeLabel(a.changes)}</div>
          {a.watch && <p className="mt-1 text-xs leading-relaxed">Watch: {a.watch}</p>}
          <div className="mt-2 flex gap-2">
            {a.state === 'applied' ? (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CheckIcon className="size-3.5" /> Applied</span>
                <Button size="xs" variant="outline" onClick={() => undoAction(m.id, a)}><Undo2Icon /> Undo</Button>
              </>
            ) : (
              <Button size="xs" onClick={() => applyAction(m.id, a)}>{a.state === 'undone' ? 'Apply again' : 'Apply'}</Button>
            )}
          </div>
        </div>
      ))}
      {m.navigate && (
        <Button size="xs" variant="outline" onClick={() => setStep(m.navigate!.step)}>
          Go to {STEPS.find((s) => s.id === m.navigate!.step)?.label} <ArrowRightIcon />
        </Button>
      )}
    </div>
  )
}

export function TutorChat() {
  const { data: status, isLoading } = useTutorStatus()
  const messages = useAppStore((s) => s.tutorMessages)
  const step = useAppStore((s) => s.step)
  const socratic = useAppStore((s) => s.socratic)
  const setSocratic = useAppStore((s) => s.setSocratic)
  const clear = useAppStore((s) => s.clearTutor)
  const { send } = useTutor()
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const busy = messages.some((m) => m.streaming)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    void send(text.trim())
    setText('')
  }

  if (isLoading) return <div className="flex flex-1 items-center justify-center"><Loader2Icon className="text-muted-foreground size-5 animate-spin" /></div>

  if (!status?.enabled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <span className="bg-muted mb-3 flex size-10 items-center justify-center rounded-full">
          <WifiOffIcon className="text-muted-foreground size-5" />
        </span>
        <p className="text-sm font-medium">Tutor offline</p>
        <p className="text-muted-foreground mt-1 max-w-64 text-sm">
          Add a free Groq key (and optionally a Gemini key for plot images) to <code>.env</code>, then restart the app.
          Everything else works without it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={socratic} onCheckedChange={(c) => setSocratic(Boolean(c))} aria-label="Socratic mode" />
          {socratic ? 'Socratic: hints first' : 'Direct answers'}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px]">{status.text_provider}{status.vision_provider ? ` + ${status.vision_provider}` : ''}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Clear conversation" disabled={!messages.length || busy} onClick={clear}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Ask about your own results. The tutor sees your current parameters and numbers (never the raw EEG) and can suggest experiments for you to apply.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS[step].map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="hover:bg-muted rounded-lg border px-3 py-2 text-left text-sm">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <MessageView key={m.id} m={m} />)}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
        <textarea
          aria-label="Message the tutor"
          value={text}
          rows={2}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          placeholder="Ask about your ERP…"
          className="border-input bg-background min-h-0 flex-1 resize-none rounded-lg border p-2 text-sm"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <SendHorizonalIcon />}
        </Button>
      </form>
      <p className="text-muted-foreground px-3 pb-2 text-[11px]">AI answers can be wrong. Check them against the plots.</p>
    </div>
  )
}
