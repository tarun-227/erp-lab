import { TargetIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EXPLAIN } from '@/content/explain'
import { STEPS, STEP_ICONS, type StepId } from '@/lib/steps'
import { cn } from '@/lib/utils'

/** Step title with its icon, a one-line purpose, and what the student will learn here. */
export function StepHeader({ id, title, text, aside }: { id: StepId; title: string; text: string; aside?: ReactNode }) {
  const index = STEPS.findIndex((s) => s.id === id)
  const Icon = STEP_ICONS[id]
  const objectives = EXPLAIN[id].objectives

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="bg-primary-soft text-primary shadow-soft hidden size-14 shrink-0 items-center justify-center rounded-2xl sm:flex">
            <Icon className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-primary text-sm font-semibold">Step {index + 1} of {STEPS.length}</p>
            <h1 tabIndex={-1} data-step-title className="mt-0.5 text-[30px] leading-9 font-extrabold tracking-tight outline-none">
              {title}
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-[68ch] text-base">{text}</p>
          </div>
        </div>
        {aside}
      </div>
      {objectives && (
        <div className="bg-card shadow-soft flex flex-wrap items-start gap-x-6 gap-y-2 rounded-2xl border px-5 py-3.5">
          <span className="text-primary flex items-center gap-2 text-sm font-semibold">
            <TargetIcon className="size-4" aria-hidden /> You'll learn
          </span>
          <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-1.5 text-[15px]">
            {objectives.map((o) => (
              <li key={o} className="flex items-baseline gap-2">
                <span aria-hidden className="bg-primary/60 size-1.5 shrink-0 translate-y-[-2px] rounded-full" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'bad' | 'muted' | 'good'
  icon?: typeof TargetIcon
}) {
  return (
    <div className="bg-card shadow-soft rounded-2xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        {Icon && <Icon className="size-4" aria-hidden />} {label}
      </div>
      <div
        className={cn(
          'font-heading mt-1 text-[28px] leading-9 font-extrabold whitespace-nowrap tabular',
          tone === 'bad' && 'text-destructive',
          tone === 'good' && 'text-success',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-muted-foreground mt-0.5 text-sm">{sub}</div>}
    </div>
  )
}
