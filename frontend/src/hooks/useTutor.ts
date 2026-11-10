import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { API_BASE, api } from '@/lib/api'
import { STEPS, type StepId } from '@/lib/steps'
import { plotPng } from '@/plots/PlotlyChart'
import { type PlotId, type TutorAction, type TutorMessage, useAppStore } from '@/store/useAppStore'

const newId = () => Math.random().toString(36).slice(2, 10)

export function useTutorStatus() {
  return useQuery({ queryKey: ['tutor-status'], queryFn: api.tutorStatus, staleTime: 60_000 })
}

/** Parse a text/event-stream body into (event, data) pairs as chunks arrive. */
export async function* readSse(res: Response): AsyncGenerator<[string, Record<string, unknown>]> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let split
    while ((split = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      yield [event, data ? JSON.parse(data) : {}]
    }
  }
}

export function useTutor() {
  const push = useAppStore((s) => s.pushTutorMessage)
  const update = useAppStore((s) => s.updateTutorMessage)

  const send = useCallback(
    async (text: string, plot?: { id: PlotId; title: string }) => {
      const s = useAppStore.getState()
      const history = s.tutorMessages
        .filter((m) => !m.error && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }))
      const userMsg: TutorMessage = { id: newId(), role: 'user', content: text, plot: plot?.title }
      const reply: TutorMessage = { id: newId(), role: 'assistant', content: '', streaming: true, actions: [], highlights: [] }
      push(userMsg)
      push(reply)

      let png: string | null = null
      if (plot) png = await plotPng(plot.id).catch(() => null)

      try {
        const res = await fetch(`${API_BASE}/tutor/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: s.dataset?.session_id ?? null,
            step: s.step,
            socratic: s.socratic,
            messages: [...history, { role: 'user', content: text }],
            plot: plot ? { name: plot.title, png_base64: png } : null,
          }),
        })
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)
        for await (const [event, data] of readSse(res)) {
          if (event === 'delta') update(reply.id, (m) => ({ ...m, content: m.content + String(data.text ?? '') }))
          else if (event === 'action') {
            const action: TutorAction = { id: newId(), state: 'pending', ...(data as Omit<TutorAction, 'id' | 'state'>) }
            update(reply.id, (m) => ({ ...m, actions: [...(m.actions ?? []), action] }))
          } else if (event === 'highlight') {
            update(reply.id, (m) => ({ ...m, highlights: [...(m.highlights ?? []), data as never] }))
            useAppStore.getState().setHighlight(data as never)
          } else if (event === 'navigate' && STEPS.some((st) => st.id === data.step)) {
            update(reply.id, (m) => ({ ...m, navigate: { step: data.step as StepId, reason: String(data.reason ?? '') } }))
          } else if (event === 'error') update(reply.id, (m) => ({ ...m, error: data as TutorMessage['error'] }))
        }
      } catch (err) {
        update(reply.id, (m) => ({ ...m, error: { kind: 'error', message: (err as Error).message } }))
      } finally {
        update(reply.id, (m) => ({ ...m, streaming: false }))
      }
    },
    [push, update],
  )

  const explainPlot = useCallback(
    (id: PlotId, title: string) => {
      const s = useAppStore.getState()
      s.openPanel('tutor')
      void send(`Explain the "${title}" plot using my results.`, { id, title })
    },
    [send],
  )

  const applyAction = useCallback(
    (messageId: string, action: TutorAction) => {
      const s = useAppStore.getState()
      if (!s.params) return
      s.replaceParams({ ...s.params, ...action.changes })
      update(messageId, (m) => ({
        ...m,
        actions: m.actions?.map((a) => (a.id === action.id ? { ...a, state: 'applied', previous: s.params! } : a)),
      }))
    },
    [update],
  )

  const undoAction = useCallback(
    (messageId: string, action: TutorAction) => {
      if (!action.previous) return
      useAppStore.getState().replaceParams(action.previous)
      update(messageId, (m) => ({
        ...m,
        actions: m.actions?.map((a) => (a.id === action.id ? { ...a, state: 'undone' } : a)),
      }))
    },
    [update],
  )

  return { send, explainPlot, applyAction, undoAction }
}
