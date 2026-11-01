import type { ReactNode } from 'react'

export function StepHeader({ step, title, text, aside }: { step: number; title: string; text: string; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">Step {step}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">{text}</p>
      </div>
      {aside}
    </header>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'bad' | 'muted' }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'muted' ? 'text-muted-foreground' : ''}`}>
        {value}
      </div>
      {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
    </div>
  )
}
