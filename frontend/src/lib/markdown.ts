/**
 * A small, safe subset of Markdown for tutor replies: paragraphs, bullet and numbered lists, headings,
 * fenced code, and inline bold, italic and code. It produces plain data (no HTML), so nothing from the
 * model is ever injected into the page.
 */

export type Inline = { type: 'text' | 'strong' | 'em' | 'code'; text: string }
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'code'; lang: string; text: string }

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^\s*```\s*(\w*)/)
    if (fence) {
      flush()
      const body: string[] = []
      i++
      // An unclosed fence (still streaming) runs to the end of the text.
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      blocks.push({ type: 'code', lang: fence[1], text: body.join('\n') })
      continue
    }
    const list = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null
    if (list) {
      flush()
      const marker = list === 'ul' ? BULLET : NUMBERED
      const items: string[] = []
      while (i < lines.length && (marker.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
        if (marker.test(lines[i])) items.push(lines[i].replace(marker, ''))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      i--
      blocks.push({ type: list, items })
      continue
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/)
    if (heading) {
      flush()
      blocks.push({ type: 'h', text: heading[1] })
      continue
    }
    if (!line.trim()) flush()
    else para.push(line.trim())
  }
  flush()
  return blocks
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![\w*])\*[^*\s][^*\n]*?\*(?![\w*]))/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    const t = m[0]
    if (t.startsWith('**')) out.push({ type: 'strong', text: t.slice(2, -2) })
    else if (t.startsWith('`')) out.push({ type: 'code', text: t.slice(1, -1) })
    else out.push({ type: 'em', text: t.slice(1, -1) })
    last = m.index + t.length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

/** A code block that is really a parameter suggestion; the server turns these into an Apply card. */
export function isProposal(code: string): boolean {
  try {
    const value = JSON.parse(code)
    return typeof value === 'object' && value !== null && 'changes' in value
  } catch {
    return false
  }
}
