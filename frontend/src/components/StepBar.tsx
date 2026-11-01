import { CheckIcon, LockIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { STEPS, canVisit } from '@/lib/steps'
import { useAppStore } from '@/store/useAppStore'

export function StepBar() {
  const step = useAppStore((s) => s.step)
  const setStep = useAppStore((s) => s.setStep)
  const hasData = useAppStore((s) => s.dataset !== null)
  const currentIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <nav aria-label="Steps" className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((s, i) => {
        const allowed = canVisit(s.id, hasData)
        const active = s.id === step
        const done = hasData && i < currentIndex
        const button = (
          <button
            type="button"
            disabled={!allowed}
            aria-current={active ? 'step' : undefined}
            onClick={() => setStep(s.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full py-1 pr-1 pl-1 text-sm whitespace-nowrap transition-colors lg:pr-3',
              active && 'bg-primary text-primary-foreground',
              !active && allowed && 'hover:bg-muted',
              !allowed && 'text-muted-foreground cursor-not-allowed opacity-60',
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                active ? 'bg-primary-foreground/20' : 'bg-muted',
                done && 'bg-primary/15 text-primary',
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : !allowed ? <LockIcon className="size-3" /> : i + 1}
            </span>
            <span className="hidden lg:inline">{s.label}</span>
          </button>
        )
        return (
          <div key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="bg-border hidden h-px w-3 md:block xl:w-5" aria-hidden />}
            <Tooltip>
              <TooltipTrigger render={<span />}>{button}</TooltipTrigger>
              <TooltipContent side="bottom">
                {allowed ? `${i + 1} · ${s.hint}` : 'Load a recording first'}
              </TooltipContent>
            </Tooltip>
          </div>
        )
      })}
    </nav>
  )
}
