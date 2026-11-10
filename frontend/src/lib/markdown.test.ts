import { describe, expect, it } from 'vitest'
import { isProposal, parseBlocks, parseInline } from './markdown'

describe('tutor reply formatting', () => {
  it('turns bold, italic and code into styled pieces', () => {
    expect(parseInline('peak **−10.35 µV** at `FCz`, *roughly* 56 ms')).toEqual([
      { type: 'text', text: 'peak ' },
      { type: 'strong', text: '−10.35 µV' },
      { type: 'text', text: ' at ' },
      { type: 'code', text: 'FCz' },
      { type: 'text', text: ', ' },
      { type: 'em', text: 'roughly' },
      { type: 'text', text: ' 56 ms' },
    ])
  })

  it('leaves multiplication signs and lone asterisks alone', () => {
    expect(parseInline('2 * 3 and 4*5')).toEqual([{ type: 'text', text: '2 * 3 and 4*5' }])
  })

  it('splits paragraphs, lists and code fences', () => {
    const blocks = parseBlocks('You rejected 102 epochs.\n\n- FP2: 64\n- F8: 25\n  (frontal)\n\n1. Raise it\n2. Compare\n\n```json\n{"a": 1}\n```')
    expect(blocks).toEqual([
      { type: 'p', text: 'You rejected 102 epochs.' },
      { type: 'ul', items: ['FP2: 64', 'F8: 25 (frontal)'] },
      { type: 'ol', items: ['Raise it', 'Compare'] },
      { type: 'code', lang: 'json', text: '{"a": 1}' },
    ])
  })

  it('keeps a code fence that is still streaming', () => {
    expect(parseBlocks('Try this:\n```json\n{"changes"')).toEqual([
      { type: 'p', text: 'Try this:' },
      { type: 'code', lang: 'json', text: '{"changes"' },
    ])
  })

  it('recognises a parameter suggestion written as JSON', () => {
    expect(isProposal('{"changes": {"reject_uv": 200}, "title": "Raise it"}')).toBe(true)
    expect(isProposal('{"a": 1}')).toBe(false)
    expect(isProposal('not json')).toBe(false)
  })
})
