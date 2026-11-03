import { InfoIcon, LightbulbIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function HelpTip({ label, help }: { label: string; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`About ${label}`}
        className="text-muted-foreground hover:text-primary -m-1.5 flex size-7 items-center justify-center rounded-full transition-colors"
      >
        <InfoIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {help}
      </TooltipContent>
    </Tooltip>
  )
}

function ControlHeader({ id, label, help, value }: { id: string; label: string; help: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </Label>
        <HelpTip label={label} help={help} />
      </div>
      <span className="bg-primary-soft text-secondary-foreground rounded-md px-2 py-0.5 font-mono text-[13px] whitespace-nowrap tabular">{value}</span>
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
    <div className="space-y-1.5">
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
    <div className="space-y-1.5">
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
        <Label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </Label>
        <HelpTip label={label} help={help} />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-card hover:border-primary/40 h-10 w-full rounded-xl border px-3 text-[15px] transition-colors"
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
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-[15px] font-medium">
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
    <section className="space-y-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h2 className="font-heading text-[15px] font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

export function Nudge({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="bg-warning-soft text-warning flex gap-2 rounded-xl px-3 py-2.5 text-sm leading-snug">
      <LightbulbIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export const fmt = {
  ms: (s: number) => `${Math.round(s * 1000)} ms`,
  hz: (v: number) => (v ? `${v} Hz` : 'off'),
  uv: (v: number) => (v ? `${v} µV` : 'off'),
  pct: (v: number) => `${Math.round(v * 100)}%`,
}
