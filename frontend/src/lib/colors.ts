// Plotly needs concrete colours, so the condition palette lives here as hex (the CSS tokens --cond-N match).

const LIGHT = ['#2f6fb7', '#e07b1a', '#1f9e74', '#c43c7a', '#7a5af5', '#8a6d3b']
const DARK = ['#6ea8ec', '#f5a35a', '#4fd1a5', '#ec6fa8', '#a993ff', '#c9a76b']

export function conditionColor(index: number, dark: boolean): string {
  const palette = dark ? DARK : LIGHT
  return palette[index % palette.length]
}

export const REJECT_COLOR = '#d64545'

export interface PlotTheme {
  dark: boolean
  text: string
  muted: string
  grid: string
  zero: string
  accent: string
}

export function plotTheme(dark: boolean): PlotTheme {
  return dark
    ? { dark, text: '#e5e5e5', muted: '#a3a3a3', grid: 'rgba(255,255,255,0.08)', zero: 'rgba(255,255,255,0.25)', accent: '#a78bfa' }
    : { dark, text: '#262626', muted: '#737373', grid: 'rgba(0,0,0,0.07)', zero: 'rgba(0,0,0,0.25)', accent: '#6d4fd8' }
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
