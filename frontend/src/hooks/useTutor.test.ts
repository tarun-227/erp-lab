import { describe, expect, it } from 'vitest'
import { readSse } from './useTutor'

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)))
        controller.close()
      },
    }),
  )
}

describe('readSse', () => {
  it('reassembles events split across network chunks', async () => {
    const res = streamOf([
      'event: delta\ndata: {"text": "Look at "}\n\nevent: del',
      'ta\ndata: {"text": "Pz µV"}\n\nevent: action\ndata: {"changes": {"h_freq": 15}}\n\n',
      'event: done\ndata: {}\n\n',
    ])
    const events = []
    for await (const e of readSse(res)) events.push(e)
    expect(events).toEqual([
      ['delta', { text: 'Look at ' }],
      ['delta', { text: 'Pz µV' }],
      ['action', { changes: { h_freq: 15 } }],
      ['done', {}],
    ])
  })
})
