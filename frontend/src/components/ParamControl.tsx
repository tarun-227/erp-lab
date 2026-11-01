import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function HelpTip({ label, help }: { label: string; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground rounded-sm">
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {help}
      </TooltipContent>
    </Tooltip>
  )
}

function ControlHeader({ id, label, help, value }: { id: string; label: string; help: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <HelpTip label={label} help={help} />
      </div>
      <span className="text-muted-foreground font-mono text-xs tabular-nums">{value}</span>
    </div>
  )
}

interface ParamControlProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  help: string
  /** Shown next to the label; defaults to the raw value. */
  format?: (value: number) => string
  onChange: (value: number) => void
}

export function ParamControl({ id, label, value, min, max, step, help, format, onChange }: ParamControlProps) {
  return (
    <div className="space-y-2.5">
      <ControlHeader id={id} label={label} help={help} value={format ? format(value) : value} />
      <Slider
        id={id}
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
      />
    </div>
  )
}

interface RangeControlProps {
  id: string
  label: string
  value: [number, number]
  min: number
  max: number
  step: number
  help: string
  format: (value: number) => string
  minGap?: number
  onChange: (value: [number, number]) => void
}

export function RangeControl({ id, label, value, min, max, step, help, format, minGap = step, onChange }: RangeControlProps) {
  return (
    <div className="space-y-2.5">
      <ControlHeader id={id} label={label} help={help} value={`${format(value[0])} → ${format(value[1])}`} />
      <Slider
        id={id}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const [a, b] = v as number[]
          if (b - a >= minGap - 1e-9) onChange([a, b])
        }}
      />
    </div>
  )
}

interface SelectControlProps {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  help: string
  onChange: (value: string) => void
}

export function SelectControl({ id, label, value, options, help, onChange }: SelectControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <HelpTip label={label} help={help} />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface SwitchControlProps {
  id: string
  label: string
  checked: boolean
  help: string
  onChange: (checked: boolean) => void
}

export function SwitchControl({ id, label, checked, help, onChange }: SwitchControlProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <HelpTip label={label} help={help} />
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(c) => onChange(Boolean(c))} />
    </div>
  )
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function Nudge({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
      {children}
    </p>
  )
}

export const fmt = {
  ms: (s: number) => `${Math.round(s * 1000)} ms`,
  hz: (v: number) => (v ? `${v} Hz` : 'off'),
  uv: (v: number) => (v ? `${v} µV` : 'off'),
  pct: (v: number) => `${Math.round(v * 100)}%`,
}
