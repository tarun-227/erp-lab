import { AlertTriangleIcon, Loader2Icon } from 'lucide-react'
import { paramsProblem } from '@/lib/presets'
import { useAppStore } from '@/store/useAppStore'

/** Explains why plots are missing or stale: invalid settings, a server error, or a refresh in progress. */
export function ProcessStatus({ isFetching, error }: { isFetching: boolean; error: Error | null }) {
  const params = useAppStore((s) => s.params)
  const problem = params ? paramsProblem(params) : null
  if (problem || error) {
    return (
      <div role="alert" className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <AlertTriangleIcon className="size-4 shrink-0" /> {problem ?? error?.message}
      </div>
    )
  }
  if (!isFetching) return null
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs" aria-live="polite">
      <Loader2Icon className="size-3.5 animate-spin" /> Updating…
    </div>
  )
}
