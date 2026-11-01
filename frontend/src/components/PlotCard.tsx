import { InfoIcon, SparklesIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTutor } from '@/hooks/useTutor'
import { cn } from '@/lib/utils'
import type { PlotId } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'

interface PlotCardProps {
  id: PlotId
  title: string
  subtitle?: ReactNode
  help: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function PlotCard({ id, title, subtitle, help, actions, children, className }: PlotCardProps) {
  const { explainPlot } = useTutor()
  const highlight = useAppStore((s) => s.highlight)
  const highlighted = highlight?.plot === id

  return (
    <section
      data-plot={id}
      className={cn(
        'bg-card rounded-xl border p-4 transition-shadow',
        highlighted && 'ring-primary/70 ring-2',
        className,
      )}
    >
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Tooltip>
              <TooltipTrigger aria-label={`About the ${title} plot`} className="text-muted-foreground hover:text-foreground">
                <InfoIcon className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{help}</TooltipContent>
            </Tooltip>
          </div>
          {subtitle && <div className="text-muted-foreground mt-0.5 text-xs">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          <Button variant="outline" size="sm" onClick={() => explainPlot(id, title)}>
            <SparklesIcon /> Explain this plot
          </Button>
        </div>
      </header>
      {highlighted && highlight?.note && (
        <p className="bg-primary/10 text-primary mb-2 rounded-md px-3 py-1.5 text-xs">Tutor: {highlight.note}</p>
      )}
      {children}
    </section>
  )
}
