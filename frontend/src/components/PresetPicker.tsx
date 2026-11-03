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
    <section className="bg-primary-soft rounded-2xl p-4" aria-labelledby="presets-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="presets-title" className="font-heading flex items-center gap-2 text-[15px] font-extrabold">
          <WandSparklesIcon className="text-primary size-4" aria-hidden /> Quick start
        </h2>
        <Button variant="ghost" size="xs" disabled={!canUndo} onClick={undoParams}>
          <Undo2Icon /> Undo
        </Button>
      </div>
      {presets.length ? (
        <>
          <p className="text-muted-foreground mt-1 text-sm">Set up a classic analysis in one click.</p>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">No presets for this file; pick your conditions in the Events step.</p>
      )}
    </section>
  )
}
