import { Undo2Icon, WandSparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { applyPreset, presetsFor } from '@/lib/presets'
import { useAppStore } from '@/store/useAppStore'

/** One-click analysis setups for the loaded dataset, with Undo. */
export function PresetPicker() {
  const dataset = useAppStore((s) => s.dataset)
  const params = useAppStore((s) => s.params)
  const replaceParams = useAppStore((s) => s.replaceParams)
  const undoParams = useAppStore((s) => s.undoParams)
  const canUndo = useAppStore((s) => s.history.length > 0)
  if (!dataset || !params) return null
  const presets = presetsFor(dataset)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <WandSparklesIcon className="size-3.5" /> Presets
        </h3>
        <Button variant="ghost" size="xs" disabled={!canUndo} onClick={undoParams}>
          <Undo2Icon /> Undo
        </Button>
      </div>
      {presets.length ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              title={p.description}
              onClick={() => {
                replaceParams(applyPreset(dataset, p, params))
                toast(`Preset: ${p.label}`, { description: p.description, id: 'preset' })
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No presets for uploaded files; pick your conditions in Events.</p>
      )}
    </div>
  )
}
