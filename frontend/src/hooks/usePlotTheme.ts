import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { conditionColor, plotTheme } from '@/lib/colors'
import { useAppStore } from '@/store/useAppStore'

export function usePlotTheme() {
  const { resolvedTheme } = useTheme()
  return useMemo(() => plotTheme(resolvedTheme === 'dark'), [resolvedTheme])
}

/** Colour for a condition, by its position in the current parameter set. */
export function useConditionColors(): (name: string) => string {
  const theme = usePlotTheme()
  const conditions = useAppStore((s) => s.params?.conditions)
  return useMemo(() => {
    const index = new Map((conditions ?? []).map((c, i) => [c.name, i]))
    return (name: string) => conditionColor(index.get(name) ?? 5, theme.dark)
  }, [conditions, theme.dark])
}
