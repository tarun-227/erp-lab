import { useMutation } from '@tanstack/react-query'
import {
  AnchorIcon,
  BookOpenCheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FilterIcon,
  FlaskConicalIcon,
  Loader2Icon,
  PartyPopperIcon,
  PlayIcon,
  RotateCcwIcon,
  ScissorsIcon,
  SigmaIcon,
  SparklesIcon,
  Trash2Icon,
  WavesIcon,
  XCircleIcon,
} from 'lucide-react'
import { useId, useState } from 'react'
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

export function runExperiment(exp: Experiment) {
  const s = useAppStore.getState()
  if (!s.params) return
  const changes = typeof exp.changes === 'function' ? exp.changes(s.params) : exp.changes
  if (Object.keys(changes).length) s.replaceParams({ ...s.params, ...changes })
  if (exp.trialsN !== undefined) s.setTrialsN(exp.trialsN)
  s.setStep(exp.step)
  toast(exp.title, { description: exp.watch, duration: 6000 })
}

export function LearnPanel() {
  const undo = useAppStore((s) => s.undoParams)
  const canUndo = useAppStore((s) => s.history.length > 0)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-warm flex items-center gap-2 text-lg font-extrabold">
          <FlaskConicalIcon className="size-5" aria-hidden /> Try this
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Each experiment changes the settings for you and opens the plot that shows the effect. Undo puts everything back.
        </p>
      </div>
      <ol className="space-y-3">
        {EXPERIMENTS.map((exp, i) => (
          <li key={exp.id} className="bg-warm-soft rounded-2xl p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-warm font-mono text-[13px]">{i + 1}</span>
              <h3 className="font-heading font-extrabold">{exp.title}</h3>
            </div>
            <p className="mt-1 text-sm leading-snug">{exp.watch}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => runExperiment(exp)}>
              <PlayIcon /> Run it
            </Button>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo}>
        <RotateCcwIcon /> Undo last change
      </Button>
    </div>
  )
}

function QuestionCard({ q, index, chosen, onChoose }: { q: QuizQuestion; index: number; chosen?: number; onChoose: (i: number) => void }) {
  const answered = chosen !== undefined
  const right = chosen === q.answer_index
  const feedbackId = useId()
  return (
    <fieldset className="bg-card shadow-soft rounded-[20px] border p-5" aria-describedby={answered ? feedbackId : undefined}>
      <legend className="sr-only">Question {index + 1}</legend>
      <p className="text-base font-medium">
        <span className="bg-primary-soft text-primary mr-2.5 inline-flex size-7 items-center justify-center rounded-full font-mono text-[13px]">
          {index + 1}
        </span>
        {q.question}
      </p>
      <div className="mt-4 grid gap-2.5 @xl:grid-cols-2">
        {q.options.map((opt, i) => {
          const correct = i === q.answer_index
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              aria-pressed={chosen === i}
              onClick={() => onChoose(i)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-left text-[15px] transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] disabled:cursor-default',
                !answered && 'hover:border-primary/50 hover:bg-primary-soft',
                answered && correct && 'border-success bg-success-soft',
                answered && chosen === i && !correct && 'border-destructive bg-destructive-soft',
                answered && !correct && chosen !== i && 'opacity-70',
              )}
            >
              {answered && correct && <CheckCircle2Icon className="text-success size-4 shrink-0" aria-label="Correct answer" />}
              {answered && chosen === i && !correct && <XCircleIcon className="text-destructive size-4 shrink-0" aria-label="Your answer" />}
              {opt}
            </button>
          )
        })}
      </div>
      {answered && (
        <p id={feedbackId} role="status" className={cn('mt-4 rounded-xl px-4 py-3 text-[15px] leading-snug', right ? 'bg-success-soft' : 'bg-destructive-soft')}>
          <b className={right ? 'text-success' : 'text-destructive'}>{right ? 'Correct. ' : 'Not quite. '}</b>
          {q.explanation}
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
      <p className="bg-card text-muted-foreground rounded-[20px] border border-dashed p-5 text-[15px]">
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
        <span className="text-muted-foreground text-sm">Written by the AI tutor from your current settings and peaks; check them critically.</span>
      </div>
      {quiz.data?.questions.map((q, i) => (
        <QuestionCard key={q.question} q={q} index={i} chosen={answers[i]} onChoose={(c) => setAnswers({ ...answers, [i]: c })} />
      ))}
      <div className="bg-card shadow-soft rounded-[20px] border p-5">
        <label htmlFor="own-words" className="font-heading block text-lg font-extrabold">Explain in your own words</label>
        <p id="own-words-help" className="text-muted-foreground mt-1 text-[15px]">{question}</p>
        <textarea
          id="own-words"
          aria-describedby="own-words-help"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          maxLength={2000}
          className="border-input bg-card mt-3 w-full rounded-xl border p-3 text-[15px]"
          placeholder="Type 2–4 sentences…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={answer.trim().length < 10 || grade.isPending} onClick={() => grade.mutate()}>
            {grade.isPending ? <Loader2Icon className="animate-spin" /> : <BookOpenCheckIcon />} Get feedback
          </Button>
          {grade.data && (
            <p role="status" className="text-[15px]">
              <b>{grade.data.score}/2</b> · {grade.data.feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function LearnMain() {
  const answers = useAppStore((s) => s.quizAnswers)
  const answerQuiz = useAppStore((s) => s.answerQuiz)
  const resetQuiz = useAppStore((s) => s.resetQuiz)
  const [open, setOpen] = useState<string | null>(null)
  const done = Object.keys(answers).length
  const score = QUIZ.filter((q, i) => answers[i] === q.answer_index).length
  const finished = done === QUIZ.length

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <StepHeader
        id="learn"
        title="Check your understanding"
        text="Six ideas behind every ERP analysis, experiments that show each one on your own data, and a short quiz."
      />

      <section aria-labelledby="concepts-title" className="space-y-4">
        <h2 id="concepts-title" className="text-xl font-extrabold">Key ideas</h2>
        <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
          {CONCEPTS.map((c) => {
            const Icon = ICONS[c.icon]
            const isOpen = open === c.id
            return (
              <button
                key={c.id}
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.id)}
                className={cn(
                  'bg-card rounded-[20px] border-2 p-5 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99]',
                  isOpen ? 'border-primary shadow-clay @xl:col-span-2 @3xl:col-span-3' : 'shadow-soft hover:border-primary/40 border-transparent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-2xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <ChevronDownIcon className={cn('text-muted-foreground size-5 transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden />
                </div>
                <h3 className="mt-3 text-lg font-extrabold">{c.title}</h3>
                <p className="text-muted-foreground mt-1 text-[15px] leading-snug">{c.summary}</p>
                {isOpen && <p className="mt-3 max-w-[70ch] text-base leading-relaxed">{c.detail}</p>}
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="quiz-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="quiz-title" className="text-xl font-extrabold">Quiz</h2>
            <p className="text-muted-foreground text-[15px]">Eight questions. Your answers are remembered in this browser.</p>
          </div>
          <Button variant="ghost" size="sm" disabled={!done} onClick={resetQuiz}>
            <RotateCcwIcon /> Start over
          </Button>
        </div>
        <div className="bg-card shadow-soft flex items-center gap-4 rounded-2xl border px-5 py-4">
          <div
            className="bg-muted h-3 flex-1 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={QUIZ.length}
            aria-valuenow={done}
          >
            <div className="bg-success h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${(done / QUIZ.length) * 100}%` }} />
          </div>
          <span className="text-[15px] font-semibold tabular">
            {done}/{QUIZ.length} answered · {score} correct
          </span>
        </div>
        {finished && (
          <div role="status" className="bg-success-soft animate-in fade-in zoom-in-95 flex items-center gap-4 rounded-[20px] p-5 duration-300">
            <span className="bg-success text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl dark:text-[#0F1024]">
              <PartyPopperIcon className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-heading text-lg font-extrabold">
                Quiz complete: {score} of {QUIZ.length} correct
              </p>
              <p className="text-[15px]">
                {score === QUIZ.length
                  ? 'A perfect score. You know your epochs from your ERPs.'
                  : 'Nice work. Re-read the explanations for the ones you missed, then try the experiments on the left.'}
              </p>
            </div>
          </div>
        )}
        {QUIZ.map((q, i) => (
          <QuestionCard key={q.question} q={q} index={i} chosen={answers[i]} onChoose={(c) => answerQuiz(i, c)} />
        ))}
      </section>

      <section aria-labelledby="ai-quiz-title" className="space-y-4">
        <h2 id="ai-quiz-title" className="text-xl font-extrabold">Questions about your own results</h2>
        <AiQuiz />
      </section>
    </div>
  )
}
