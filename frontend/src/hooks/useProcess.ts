import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { paramsProblem } from '@/lib/presets'
import type { ProcessParams } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'

export function useDebounced<T>(value: T, ms = 200): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** The epochs + ERP for the current parameters, refetched (debounced) whenever they change. */
export function useProcess() {
  const sid = useAppStore((s) => s.dataset?.session_id)
  const params = useAppStore((s) => s.params)
  const sfreq = useAppStore((s) => s.dataset?.summary.sfreq)
  const debounced = useDebounced(params)
  return useQuery({
    queryKey: ['process', sid, debounced],
    queryFn: ({ signal }) => api.process(sid!, debounced as ProcessParams, signal),
    enabled: Boolean(sid && debounced && !paramsProblem(debounced, sfreq)),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  })
}

export function useTopo() {
  const sid = useAppStore((s) => s.dataset?.session_id)
  const hasPositions = useAppStore((s) => s.dataset?.has_positions)
  return useQuery({
    queryKey: ['topo', sid],
    queryFn: () => api.topo(sid!),
    enabled: Boolean(sid && hasPositions),
    staleTime: Infinity,
  })
}

/** Tells the student when a parameter change altered how many epochs survive. */
export function useKeptToast(kept: number | undefined) {
  const previous = useRef<number | undefined>(undefined)
  const sid = useAppStore((s) => s.dataset?.session_id)
  const lastSid = useRef(sid)
  useEffect(() => {
    if (sid !== lastSid.current) {
      lastSid.current = sid
      previous.current = kept
      return
    }
    if (kept !== undefined && previous.current !== undefined && kept !== previous.current) {
      const diff = kept - previous.current
      toast(`${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} epoch${Math.abs(diff) === 1 ? '' : 's'} kept`, {
        description: `${kept} epochs now go into the averages.`,
        id: 'kept-change',
      })
    }
    previous.current = kept
  }, [kept, sid])
}
