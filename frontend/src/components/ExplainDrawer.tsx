import { BookOpenIcon, FlaskConicalIcon, MessageCircleQuestionIcon, SparklesIcon, XIcon } from 'lucide-react'
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
      aria-label="Guide and tutor"
      data-tour="drawer"
      className="bg-card shadow-pop fixed inset-x-0 top-16 bottom-0 z-30 flex flex-col border-l sm:left-auto sm:w-[400px] xl:static xl:z-auto xl:shadow-none"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'explain' | 'tutor')} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-2 border-b p-3">
          <TabsList className="flex-1">
            <TabsTrigger value="explain">
              <BookOpenIcon /> Guide
            </TabsTrigger>
            <TabsTrigger value="tutor">
              <SparklesIcon /> Tutor
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon-sm" aria-label="Close the guide and tutor panel" onClick={() => toggleDrawer(false)}>
            <XIcon />
          </Button>
        </div>

        <TabsContent value="explain" className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h2 className="text-xl font-extrabold">{entry.title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
              {entry.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
          {entry.tryThis && (
            <section className="bg-warm-soft rounded-2xl p-4" aria-labelledby="guide-try">
              <h3 id="guide-try" className="text-warm flex items-center gap-2 text-[15px] font-extrabold">
                <FlaskConicalIcon className="size-4" aria-hidden /> Try this
              </h3>
              <ul className="mt-2.5 space-y-2 text-[15px] leading-snug">
                {entry.tryThis.map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden className="bg-warm mt-2 size-1.5 shrink-0 rounded-full" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {entry.questions && (
            <section className="bg-primary-soft rounded-2xl p-4" aria-labelledby="guide-questions">
              <h3 id="guide-questions" className="text-primary flex items-center gap-2 text-[15px] font-extrabold">
                <MessageCircleQuestionIcon className="size-4" aria-hidden /> Think about it
              </h3>
              <ol className="mt-2.5 list-decimal space-y-2 pl-5 text-[15px] leading-snug">
                {entry.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('tutor')}>
                <SparklesIcon /> Discuss with the tutor
              </Button>
            </section>
          )}
        </TabsContent>

        <TabsContent value="tutor" className="flex min-h-0 flex-1 flex-col">
          <TutorChat />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
