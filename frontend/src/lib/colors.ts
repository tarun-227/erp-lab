// Plotly needs concrete colours, so the palette lives here as hex. It matches the CSS tokens in
// index.css and the data colours in design-system/erp-lab/MASTER.md (colour-blind-safe order).

const LIGHT = ['#2563EB', '#EA580C', '#0D9488', '#DB2777', '#7C3AED', '#CA8A04']
const DARK = ['#60A5FA', '#FB923C', '#2DD4BF', '#F472B6', '#A78BFA', '#FACC15']

export function conditionColor(index: number, dark: boolean): string {
  const palette = dark ? DARK : LIGHT
  return palette[index % palette.length]
}

export const REJECT_COLOR = '#DC2626'

export interface PlotTheme {
  dark: boolean
  text: string
  muted: string
  grid: string
  zero: string
  accent: string
  surface: string
}

export function plotTheme(dark: boolean): PlotTheme {
  return dark
    ? { dark, text: '#E8EAFF', muted: '#A1A7C8', grid: 'rgba(232,234,255,0.08)', zero: 'rgba(232,234,255,0.3)', accent: '#A5B4FC', surface: '#181A33' }
    : { dark, text: '#1E1B4B', muted: '#475569', grid: 'rgba(30,27,75,0.07)', zero: 'rgba(30,27,75,0.3)', accent: '#4F46E5', surface: '#FFFFFF' }
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
