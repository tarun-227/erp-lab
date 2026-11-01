import { BookOpenIcon, BrainCircuitIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { StepBar } from './StepBar'

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme()
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const toggleDrawer = useAppStore((s) => s.toggleDrawer)
  const dark = resolvedTheme === 'dark'

  return (
    <header className="bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b px-4 backdrop-blur">
      <div className="flex shrink-0 items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <BrainCircuitIcon className="size-4.5" />
        </span>
        <div className="hidden leading-tight sm:block">
          <div className="text-sm font-semibold">ERP Lab</div>
          <div className="text-muted-foreground text-xs">Epoching &amp; event-related potentials</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 justify-center" data-tour="steps">
        <StepBar />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
        <Button
          data-tour="drawer-toggle"
          variant={drawerOpen ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={drawerOpen ? 'Hide the Explain panel' : 'Show the Explain panel'}
          aria-pressed={drawerOpen}
          onClick={() => toggleDrawer()}
        >
          <BookOpenIcon />
        </Button>
      </div>
    </header>
  )
}
