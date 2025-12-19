export type Device = { id: string; name: string }
export type MetricMeta = { id: string; name: string; unit: string; sourceType: 'http' | 'mqtt' | 'opcua'; axisId: string; axisName: string }
export type MetricTreeDevice = { id: string; name: string; metrics: MetricMeta[] }
export type CollectDetail = { id: string; quality: 'good' | 'timeout' | 'bad' | 'parse_error' | 'source_error'; reason?: string; value: number | null; duration_ms: number }
export type EventItem = { id: number; title: string; description?: string; ref_id: string; event_time: string; category: 'maintenance' | 'fault' | 'calibration' | 'other' }
export type ReportRequestChart = { id: string; metrics: string[] }
export type ReportResponse = {
  summary: string
  start: number
  end: number
  charts: number
  metrics: number
  events: number
}

const devBase =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:5001'
    : ''
const base = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}`.replace(/\/$/, '') : devBase
const API_PREFIX = (base ? base : '') + '/api'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
    }
    return (await res.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function getDevices(): Promise<Device[]> {
  return await requestJson<Device[]>('/devices', { method: 'GET' })
}

export async function getMetricTree(): Promise<MetricTreeDevice[]> {
  return await requestJson<MetricTreeDevice[]>('/metric-tree', { method: 'GET' })
}

export async function getMetrics(deviceId: string): Promise<MetricMeta[]> {
  return await requestJson<MetricMeta[]>(`/metrics?deviceId=${encodeURIComponent(deviceId)}`, { method: 'GET' })
}

export async function collect(targets: string[]): Promise<{ success_count: number; failed_count: number; details: CollectDetail[]; timestamp: string }> {
  return await requestJson('/collect', { method: 'POST', body: JSON.stringify({ targets }) })
}

export async function getData(ids: string[], start: number, end: number): Promise<{ data: Record<string, Array<{ t: number; v: number }>> }> {
  return await requestJson('/data', { method: 'POST', body: JSON.stringify({ ids, start, end }) })
}

export async function getEvents(refIds: string[], start: number, end: number): Promise<EventItem[]> {
  const params = new URLSearchParams()
  refIds.forEach((r) => params.append('refIds', r))
  params.set('start', String(start))
  params.set('end', String(end))
  return await requestJson<EventItem[]>(`/events?${params.toString()}`, { method: 'GET' })
}

export async function createEvent(input: { title: string; description?: string; ref_id: string; category: EventItem['category']; event_time?: string }): Promise<EventItem> {
  return await requestJson<EventItem>('/events', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateEvent(id: number, input: Partial<EventItem>): Promise<EventItem> {
  return await requestJson<EventItem>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function createReport(input: { start: number; end: number; deviceId?: string; charts: ReportRequestChart[] }): Promise<ReportResponse> {
  return await requestJson<ReportResponse>('/report', { method: 'POST', body: JSON.stringify(input) })
}

export function toMetricId(deviceId: string, metricKey: string) {
  return `${deviceId}.${metricKey}`
}
