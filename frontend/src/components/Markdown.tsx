import { type Inline, isProposal, parseBlocks, parseInline } from '@/lib/markdown'

function InlineText({ text }: { text: string }) {
  return parseInline(text).map((t: Inline, i) =>
    t.type === 'strong' ? <strong key={i} className="font-semibold">{t.text}</strong>
      : t.type === 'em' ? <em key={i}>{t.text}</em>
        : t.type === 'code' ? <code key={i} className="bg-background/70 rounded px-1 font-mono text-[13px]">{t.text}</code>
          : <span key={i}>{t.text}</span>,
  )
}

/** Renders a tutor reply. Suggestions written as JSON are hidden here; they appear as a card instead. */
export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text).filter((b) => !(b.type === 'code' && isProposal(b.text)))
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i} className="whitespace-pre-line"><InlineText text={b.text} /></p>
        if (b.type === 'h') return <p key={i} className="font-semibold"><InlineText text={b.text} /></p>
        if (b.type === 'code') {
          return <pre key={i} className="bg-background/70 overflow-x-auto rounded-lg p-2.5 font-mono text-[13px]">{b.text}</pre>
        }
        const List = b.type
        return (
          <List key={i} className={b.type === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}>
            {b.items.map((item, j) => <li key={j}><InlineText text={item} /></li>)}
          </List>
        )
      })}
    </div>
  )
}
