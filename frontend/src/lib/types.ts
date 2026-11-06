// Mirrors backend/erp_module/schemas.py and the dicts returned by core/pipeline.py and core/topo.py.

export interface DataSummary {
  n_channels: number
  ch_names: string[]
  sfreq: number
  duration_s: number
  n_events: number
  event_counts: Record<string, number>
}

export interface LoadResponse {
  session_id: string
  source: 'sample' | 'upload'
  summary: DataSummary
  suggested_event_names: Record<string, string>
  description: string
  has_positions: boolean
}

export interface Condition {
  code: number
  name: string
}

export interface ProcessParams {
  conditions: Condition[]
  l_freq: number
  h_freq: number
  reference: string
  tmin: number
  tmax: number
  baseline: boolean
  baseline_start: number
  baseline_end: number
  reject_uv: number
  channel: string
  peak_start: number
  peak_end: number
  polarity: 'positive' | 'negative'
}

export interface Peak {
  latency_s: number
  amplitude_uv: number
}

export interface ConditionResult {
  name: string
  code: number
  n_total: number
  n_kept: number
  mean?: number[]
  ci?: number[]
  peak?: Peak | null
  mean_amplitude_uv?: number | null
  area50_latency_s?: number | null
  /** Standardized measurement error of the mean amplitude (Luck et al., 2021). */
  sme_uv?: number | null
  /** Channels × times, for the scalp map. */
  topo_mean?: number[][]
}

export interface DropSummary {
  total_events: number
  edge: number
  /** Events whose window overlaps a segment marked BAD in the recording. */
  bad_span?: number
  /** Events at the same sample as an earlier one. */
  duplicate?: number
  rejected: number
  kept: number
  by_channel: Record<string, number>
}

export interface ProcessResult {
  times: number[]
  channel: string
  ch_names: string[]
  /** Epochs × times at `channel`, in µV. */
  trials: number[][]
  labels: string[]
  kept: boolean[]
  event_times_s: number[]
  worst_channel: string[]
  max_ptp_uv: number[]
  drop: DropSummary
  conditions: ConditionResult[]
  difference: {
    label: string
    wave: number[]
    peak: Peak | null
    mean_amplitude_uv: number | null
    area50_latency_s: number | null
    sme_uv: number | null
  } | null
  /** Signed r² (second − first condition) for every channel × time, channels ordered front to back. */
  discriminability: { label: string; ch_names: string[]; values: number[][]; max_abs: number } | null
}

export interface RawWindow {
  times: number[]
  ch_names: string[]
  data: number[][]
  duration_total_s: number
}

export interface TopoLayout {
  ch_names: string[]
  x: number[]
  y: number[]
  radius: number
  axis: number[]
  inside: number[]
  weights: number[][]
}

export interface ExportResult {
  script: string
  params: ProcessParams
}

export interface TutorStatus {
  enabled: boolean
  text_provider: string | null
  vision_provider: string | null
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer_index: number
  explanation: string
}
