import { CheckIcon, LockIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { STEPS, STEP_ICONS, canVisit } from '@/lib/steps'
import { useAppStore } from '@/store/useAppStore'

/** The lesson path: six labelled steps; done ones get a green check, locked ones say why. */
export function StepBar() {
  const step = useAppStore((s) => s.step)
  const setStep = useAppStore((s) => s.setStep)
  const visited = useAppStore((s) => s.visited)
  const hasData = useAppStore((s) => s.dataset !== null)

  return (
    <nav aria-label="Lesson steps">
      <ol className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const allowed = canVisit(s.id, hasData)
          const active = s.id === step
          const done = hasData && visited.includes(s.id) && !active
          const Icon = STEP_ICONS[s.id]
          const button = (
            <button
              type="button"
              disabled={!allowed}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s.label}${done ? ' (visited)' : ''}${allowed ? '' : ' (locked)'}`}
              onClick={() => setStep(s.id)}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2 rounded-full py-1 pr-1 pl-1 text-[15px] font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-200 lg:pr-3.5',
                active && 'bg-primary text-primary-foreground shadow-clay',
                !active && allowed && 'text-foreground hover:bg-primary-soft',
                !allowed && 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors duration-200',
                  active && 'bg-white/20',
                  !active && done && 'bg-success-soft text-success',
                  !active && !done && allowed && 'bg-primary-soft text-primary',
                  !allowed && 'bg-muted',
                )}
              >
                {!allowed ? <LockIcon className="size-3.5" /> : done ? <CheckIcon className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
              </span>
              <span className="hidden lg:inline 2xl:hidden">{s.short}</span>
              <span className="hidden 2xl:inline">{s.label}</span>
            </button>
          )
          return (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('hidden h-0.5 w-2 rounded-full md:block 2xl:w-6', hasData && visited.includes(s.id) ? 'bg-success/50' : 'bg-border')}
                />
              )}
              <Tooltip>
                <TooltipTrigger render={<span />}>{button}</TooltipTrigger>
                <TooltipContent side="bottom">
                  {allowed ? `${i + 1} · ${s.hint}` : 'Load a recording first'}
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
