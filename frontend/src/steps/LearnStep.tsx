import { useMutation } from '@tanstack/react-query'
import {
  AnchorIcon,
  BookOpenCheckIcon,
  CheckCircle2Icon,
  FilterIcon,
  FlaskConicalIcon,
  Loader2Icon,
  RotateCcwIcon,
  ScissorsIcon,
  SigmaIcon,
  SparklesIcon,
  Trash2Icon,
  WavesIcon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CONCEPTS, EXPERIMENTS, QUIZ, type Experiment } from '@/content/learn'
import { useTutorStatus } from '@/hooks/useTutor'
import { api } from '@/lib/api'
import type { QuizQuestion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { StepHeader } from './StepHeader'

const ICONS = { scissors: ScissorsIcon, baseline: WavesIcon, sigma: SigmaIcon, filter: FilterIcon, trash: Trash2Icon, anchor: AnchorIcon }
const STORAGE_KEY = 'erp-lab-quiz'

function loadAnswers(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function runExperiment(exp: Experiment) {
  const s = useAppStore.getState()
  if (!s.params) return
  const changes = typeof exp.changes === 'function' ? exp.changes(s.params) : exp.changes
  if (Object.keys(changes).length) s.replaceParams({ ...s.params, ...changes })
  if (exp.trialsN !== undefined) s.setTrialsN(exp.trialsN)
  s.setStep(exp.step)
  toast(exp.title, { description: exp.watch, duration: 9000 })
}

export function LearnPanel() {
  const undo = useAppStore((s) => s.undoParams)
  const canUndo = useAppStore((s) => s.history.length > 0)
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConicalIcon className="text-primary size-4" /> Try this
      </h2>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Each experiment changes the app's settings for you and takes you to the right plot. Undo puts the settings back.
      </p>
      {EXPERIMENTS.map((exp) => (
        <div key={exp.id} className="rounded-lg border p-3">
          <div className="text-sm font-medium">{exp.title}</div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{exp.watch}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => runExperiment(exp)}>
            Run it
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo}>
        <RotateCcwIcon /> Undo last change
      </Button>
    </div>
  )
}

function QuestionCard({ q, index, chosen, onChoose }: { q: QuizQuestion; index: number; chosen?: number; onChoose: (i: number) => void }) {
  const answered = chosen !== undefined
  return (
    <fieldset className="rounded-xl border p-4">
      <legend className="sr-only">Question {index + 1}</legend>
      <p className="text-sm font-medium">
        <span className="text-muted-foreground mr-2">{index + 1}.</span>
        {q.question}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const correct = i === q.answer_index
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => onChoose(i)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                !answered && 'hover:bg-muted',
                answered && correct && 'border-emerald-500 bg-emerald-500/10',
                answered && chosen === i && !correct && 'border-red-500 bg-red-500/10',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {answered && (
        <p className={cn('mt-3 flex gap-2 text-sm', chosen === q.answer_index ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
          {chosen === q.answer_index ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" /> : <XCircleIcon className="mt-0.5 size-4 shrink-0" />}
          <span>
            <b>{chosen === q.answer_index ? 'Correct. ' : 'Not quite. '}</b>
            <span className="text-foreground">{q.explanation}</span>
          </span>
        </p>
      )}
    </fieldset>
  )
}

function AiQuiz() {
  const sid = useAppStore((s) => s.dataset?.session_id ?? null)
  const { data: status } = useTutorStatus()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const quiz = useMutation({
    mutationFn: () => api.quiz(sid, 'learn', 3),
    onSuccess: () => setAnswers({}),
    onError: (e) => toast.error('Could not generate questions', { description: e.message }),
  })
  const [question] = useState('Why does averaging more trials make the ERP clearer? Use your own results.')
  const [answer, setAnswer] = useState('')
  const grade = useMutation({
    mutationFn: () => api.grade(sid, 'learn', question, answer),
    onError: (e) => toast.error('Could not grade the answer', { description: e.message }),
  })

  if (!status?.enabled) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        The AI tutor is offline, so questions about your own results are unavailable. Add a free Groq key to <code>.env</code> to enable them.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => quiz.mutate()} disabled={quiz.isPending}>
          {quiz.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Generate questions from my results
        </Button>
        <span className="text-muted-foreground text-xs">Written by the AI tutor from your current parameters and peaks; check them critically.</span>
      </div>
      {quiz.data?.questions.map((q, i) => (
        <QuestionCard key={q.question} q={q} index={i} chosen={answers[i]} onChoose={(c) => setAnswers({ ...answers, [i]: c })} />
      ))}
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Explain in your own words</p>
        <p className="text-muted-foreground mt-1 text-sm">{question}</p>
        <textarea
          aria-label="Your answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          maxLength={2000}
          className="border-input bg-background mt-3 w-full rounded-lg border p-2 text-sm"
          placeholder="Type 2–4 sentences…"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" disabled={answer.trim().length < 10 || grade.isPending} onClick={() => grade.mutate()}>
            {grade.isPending ? <Loader2Icon className="animate-spin" /> : <BookOpenCheckIcon />} Get feedback
          </Button>
          {grade.data && (
            <span className="text-sm">
              <b>{grade.data.score}/2</b> · {grade.data.feedback}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function LearnMain() {
  const [answers, setAnswers] = useState<Record<number, number>>(loadAnswers)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
    } catch {
      /* storage unavailable: progress just is not remembered */
    }
  }, [answers])
  const done = Object.keys(answers).length
  const score = QUIZ.filter((q, i) => answers[i] === q.answer_index).length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <StepHeader
        step={5}
        title="Check your understanding"
        text="Six ideas behind every ERP analysis, experiments that show each one on your data, and a quiz."
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONCEPTS.map((c) => {
          const Icon = ICONS[c.icon]
          const isOpen = open === c.id
          return (
            <button
              key={c.id}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : c.id)}
              className={cn('rounded-xl border p-4 text-left transition-shadow hover:shadow-sm', isOpen && 'ring-primary/50 ring-2 sm:col-span-2 lg:col-span-3')}
            >
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-4.5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{c.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{c.summary}</p>
              {isOpen && <p className="mt-3 max-w-3xl text-sm leading-relaxed">{c.detail}</p>}
            </button>
          )
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Quiz</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="tabular-nums">
              {score} / {QUIZ.length} correct · {done} answered
            </span>
            <Button variant="ghost" size="sm" disabled={!done} onClick={() => setAnswers({})}>
              <RotateCcwIcon /> Reset
            </Button>
          </div>
        </div>
        {QUIZ.map((q, i) => (
          <QuestionCard key={q.question} q={q} index={i} chosen={answers[i]} onChoose={(c) => setAnswers({ ...answers, [i]: c })} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Questions about your own results</h2>
        <AiQuiz />
      </section>
    </div>
  )
}
