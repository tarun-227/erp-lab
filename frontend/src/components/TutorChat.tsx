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
  load: ['What is an ERP, in one paragraph?', 'What happens in this experiment?'],
  events: ['Why do rare targets give a noisier average?', 'Which conditions should I compare?'],
  epoching: ['Why were these epochs rejected?', 'Is my rejection threshold sensible?', 'What does the high-pass filter do here?'],
  erp: ['Is this effect real or noise?', 'Why is the difference wave largest there?', 'How many trials do I really need?'],
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
      <div className="bg-primary text-primary-foreground ml-10 rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-snug">
        {m.plot && (
          <div className="mb-1 flex items-center gap-1.5 text-[13px] opacity-90">
            <ImageIcon className="size-3.5" aria-hidden /> {m.plot} plot attached
          </div>
        )}
        {m.content}
      </div>
    )
  }
  return (
    <div className="mr-6 space-y-2">
      {(m.content || m.streaming) && (
        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {m.content}
          {m.streaming && <span className="bg-foreground/60 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />}
        </div>
      )}
      {m.error && (
        <div role="alert" className={cn('rounded-xl px-3 py-2.5 text-sm', m.error.kind === 'busy' ? 'bg-warning-soft text-warning' : 'bg-destructive-soft text-destructive')}>
          {m.error.message}
        </div>
      )}
      {m.actions?.map((a) => (
        <div key={a.id} className="border-primary/25 bg-primary-soft shadow-soft rounded-2xl border p-4">
          <div className="text-primary flex items-center gap-1.5 text-sm font-semibold">
            <SparklesIcon className="size-4" aria-hidden /> Suggested experiment
          </div>
          <div className="font-heading mt-1 text-base font-extrabold">{a.title}</div>
          <div className="text-muted-foreground font-mono text-[13px]">{changeLabel(a.changes)}</div>
          {a.watch && <p className="mt-1.5 text-sm leading-snug"><b>Watch:</b> {a.watch}</p>}
          <div className="mt-3 flex items-center gap-2">
            {a.state === 'applied' ? (
              <>
                <span className="text-success flex items-center gap-1 text-sm font-medium"><CheckIcon className="size-4" aria-hidden /> Applied</span>
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
        <span className="bg-primary-soft text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
          <WifiOffIcon className="size-6" aria-hidden />
        </span>
        <p className="font-heading text-lg font-extrabold">Tutor offline</p>
        <p className="text-muted-foreground mt-1.5 max-w-72 text-[15px] leading-snug">
          Add a free Groq key (and optionally a Gemini key for plot images) to <code>.env</code>, then restart the app.
          Everything else works without it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={socratic} onCheckedChange={(c) => setSocratic(Boolean(c))} aria-label="Socratic mode" />
          {socratic ? 'Socratic: hints first' : 'Direct answers'}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{status.text_provider}{status.vision_provider ? ` + ${status.vision_provider}` : ''}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Clear conversation" disabled={!messages.length || busy} onClick={clear}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-[15px] leading-snug">
              Ask about your own results. The tutor sees your current parameters and numbers (never the raw EEG) and can suggest experiments for you to apply.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS[step].map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="bg-card hover:border-primary/40 hover:bg-primary-soft rounded-xl border px-3.5 py-2.5 text-left text-[15px] transition-colors">
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
          className="border-input bg-card min-h-0 flex-1 resize-none rounded-xl border px-3 py-2 text-[15px]"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <SendHorizonalIcon />}
        </Button>
      </form>
      <p className="text-muted-foreground px-3 pb-3 text-xs">AI answers can be wrong. Check them against the plots.</p>
    </div>
  )
}
