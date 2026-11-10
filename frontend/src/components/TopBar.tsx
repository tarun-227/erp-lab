import { BookOpenIcon, BrainCircuitIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QUIZ } from '@/content/learn'
import { STEPS } from '@/lib/steps'
import { useAppStore } from '@/store/useAppStore'
import { StepBar } from './StepBar'

/** Course progress: steps opened and quiz score, as a small ring. */
function ProgressRing() {
  const visited = useAppStore((s) => s.visited)
  const hasData = useAppStore((s) => s.dataset !== null)
  const answers = useAppStore((s) => s.quizAnswers)
  const steps = hasData ? visited.length : 0
  const correct = QUIZ.filter((q, i) => answers[i] === q.answer_index).length
  const share = steps / STEPS.length
  const r = 15
  const c = 2 * Math.PI * r
  const label = `${steps} of ${STEPS.length} steps explored, quiz ${correct} of ${QUIZ.length} correct`

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div role="img" aria-label={label} />}
        className="hidden items-center gap-2 rounded-full p-1 md:flex 2xl:pr-3"
      >
        <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--muted)" strokeWidth="4" />
          <circle
            cx="18" cy="18" r={r} fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - share)} className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span className="hidden leading-tight 2xl:block">
          <span className="block text-sm font-semibold tabular">{steps}/{STEPS.length} steps</span>
          <span className="text-muted-foreground block text-xs tabular">Quiz {correct}/{QUIZ.length}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme()
  const guideOpen = useAppStore((s) => !s.panelCollapsed && s.panelTab === 'explain')
  const openPanel = useAppStore((s) => s.openPanel)
  const togglePanel = useAppStore((s) => s.togglePanel)
  const dark = resolvedTheme === 'dark'

  return (
    <header className="bg-card/85 sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b px-4 backdrop-blur lg:px-6">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="bg-primary text-primary-foreground shadow-clay flex size-10 items-center justify-center rounded-2xl">
          <BrainCircuitIcon className="size-5" aria-hidden />
        </span>
        <div className="hidden leading-tight sm:block">
          <div className="font-heading text-lg font-extrabold">ERP Lab</div>
          <div className="text-muted-foreground text-xs">Learn epoching &amp; ERPs</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 justify-center overflow-x-auto" data-tour="steps">
        <StepBar />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ProgressRing />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => setTheme(dark ? 'light' : 'dark')}
              />
            }
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </TooltipTrigger>
          <TooltipContent side="bottom">{dark ? 'Light theme' : 'Dark theme'}</TooltipContent>
        </Tooltip>
        <Button
          variant={guideOpen ? 'secondary' : 'outline'}
          aria-pressed={guideOpen}
          aria-label={guideOpen ? 'Hide the guide' : 'Show the guide'}
          onClick={() => (guideOpen ? togglePanel(true) : openPanel('explain'))}
        >
          <BookOpenIcon /> <span className="hidden sm:inline">Guide</span>
        </Button>
      </div>
    </header>
  )
}
