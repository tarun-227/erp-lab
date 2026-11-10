import { FlaskConicalIcon, MessageCircleQuestionIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EXPLAIN } from '@/content/explain'
import { useAppStore } from '@/store/useAppStore'

/** The Guide tab: background, ideas to try and questions for the current step. */
export function GuideContent() {
  const step = useAppStore((s) => s.step)
  const setTab = useAppStore((s) => s.setPanelTab)
  const entry = EXPLAIN[step]

  return (
    <div className="space-y-6">
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
    </div>
  )
}
