import { FlaskConicalIcon, SparklesIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EXPLAIN } from '@/content/explain'
import { useAppStore } from '@/store/useAppStore'
import { TutorChat } from './TutorChat'

export function ExplainDrawer() {
  const step = useAppStore((s) => s.step)
  const tab = useAppStore((s) => s.drawerTab)
  const setTab = useAppStore((s) => s.setDrawerTab)
  const toggleDrawer = useAppStore((s) => s.toggleDrawer)
  const entry = EXPLAIN[step]

  return (
    <aside
      aria-label="Explain panel"
      data-tour="drawer"
      className="bg-background fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col border-l sm:left-auto sm:w-96 xl:static xl:z-auto"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'explain' | 'tutor')} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-2 border-b p-3">
          <TabsList className="flex-1">
            <TabsTrigger value="explain">Explain</TabsTrigger>
            <TabsTrigger value="tutor">
              <SparklesIcon /> Tutor
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={() => toggleDrawer(false)}>
            <XIcon />
          </Button>
        </div>

        <TabsContent value="explain" className="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">{entry.title}</h2>
          <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
            {entry.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {entry.tryThis && (
            <div className="bg-primary/5 mt-6 rounded-xl p-4">
              <div className="text-primary mb-2 flex items-center gap-2 text-sm font-semibold">
                <FlaskConicalIcon className="size-4" /> Try this
              </div>
              <ul className="space-y-2 text-sm leading-relaxed">
                {entry.tryThis.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.questions && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Questions to think about</h3>
              <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {entry.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tutor" className="flex min-h-0 flex-1 flex-col">
          <TutorChat />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
