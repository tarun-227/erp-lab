import type { SampleId } from './samples'
import type {
  ExportResult,
  LoadResponse,
  ProcessParams,
  ProcessResult,
  QuizQuestion,
  RawWindow,
  TopoLayout,
  TutorStatus,
} from './types'

/** API root. Follows Vite's base path, so a build with --base=/modules/erp/ calls /modules/erp/api. */
export const API_BASE = `${import.meta.env.BASE_URL}api`

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function detailMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '')
  return `Request failed (${status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, detailMessage(body, res.status))
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body), signal })

export const api = {
  health: () => request<{ status: string; real_sample: boolean; samples?: Partial<Record<SampleId, boolean>> }>('/health'),
  loadSample: (sample: SampleId) => post<LoadResponse>('/data/sample', { sample }),
  upload: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return request<LoadResponse>('/data/upload', { method: 'POST', body: form })
  },
  process: (sid: string, params: ProcessParams, signal?: AbortSignal) =>
    post<ProcessResult>(`/sessions/${sid}/process`, params, signal),
  raw: (sid: string, params: ProcessParams, start_s: number, duration_s: number, signal?: AbortSignal) =>
    post<RawWindow>(`/sessions/${sid}/raw`, { params, start_s, duration_s }, signal),
  events: (sid: string) => request<{ times_s: number[]; codes: number[] }>(`/sessions/${sid}/events`),
  topo: (sid: string) => request<TopoLayout>(`/sessions/${sid}/topo`),
  export: (sid: string, params: ProcessParams) => post<ExportResult>(`/sessions/${sid}/export`, params),
  recordingUrl: (sid: string) => `${API_BASE}/sessions/${sid}/recording.fif`,
  tutorStatus: () => request<TutorStatus>('/tutor/status'),
  quiz: (session_id: string | null, step: string, n: number) =>
    post<{ questions: QuizQuestion[] }>('/tutor/quiz', { session_id, step, n }),
  grade: (session_id: string | null, step: string, question: string, answer: string) =>
    post<{ score: number; feedback: string }>('/tutor/grade', { session_id, step, question, answer }),
}
