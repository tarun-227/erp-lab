import { createContext, useContext } from 'react'

/** Set by PlotCard when its plot is expanded; the chart then grows to this height instead of its default. */
export const PlotExpandContext = createContext<number | null>(null)

export function useExpandedHeight(): number | null {
  return useContext(PlotExpandContext)
}
