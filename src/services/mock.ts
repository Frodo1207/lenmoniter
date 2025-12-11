import dayjs from 'dayjs'

export type Device = { id: string; name: string }
export type MetricMeta = { id: string; name: string; unit: string; sourceType: 'http' | 'mqtt' | 'opcua'; axisId: string; axisName: string }
export type MetricTreeDevice = { id: string; name: string; axes: Array<{ id: string; name: string; metrics: MetricMeta[] }> }
export type CollectDetail = { id: string; quality: 'good' | 'timeout' | 'bad' | 'parse_error' | 'source_error'; reason?: string; value: number | null; duration_ms: number }
export type EventItem = { id: number; title: string; description?: string; ref_id: string; event_time: string; category: 'maintenance' | 'fault' | 'calibration' | 'other' }

const tree: MetricTreeDevice[] = [
  {
    id: 'POAM1',
    name: 'POAM1',
    axes: [
      {
        id: 'Z',
        name: 'Z',
        metrics: [
          { id: 'MA', name: 'MA', unit: 'A', sourceType: 'http', axisId: 'Z', axisName: 'Z' },
          { id: 'MSD', name: 'MSD', unit: 'μm', sourceType: 'mqtt', axisId: 'Z', axisName: 'Z' },
        ],
      },
      {
        id: 'Rx',
        name: 'Rx',
        metrics: [
          { id: 'MA_3A', name: 'MA_3A', unit: 'A', sourceType: 'opcua', axisId: 'Rx', axisName: 'Rx' },
        ],
      },
    ],
  },
]

export async function getDevices(): Promise<Device[]> {
  return tree.map((d) => ({ id: d.id, name: d.name }))
}

export async function getMetricTree(): Promise<MetricTreeDevice[]> {
  return tree
}

export async function getMetrics(deviceId: string): Promise<MetricMeta[]> {
  const dev = tree.find((d) => d.id === deviceId)
  if (!dev) return []
  return dev.axes.flatMap((a) => a.metrics.map((m) => ({ ...m })))
}

export async function collect(targets: string[]): Promise<{ success_count: number; failed_count: number; details: CollectDetail[]; timestamp: string }> {
  const details: CollectDetail[] = targets.map((id) => {
    const ok = Math.random() > 0.15
    return {
      id,
      quality: ok ? 'good' : 'timeout',
      reason: ok ? undefined : 'mock_timeout',
      value: ok ? +(50 + Math.random() * 50).toFixed(2) : null,
      duration_ms: ok ? Math.floor(80 + Math.random() * 180) : 5000,
    }
  })
  return {
    success_count: details.filter((d) => d.quality === 'good').length,
    failed_count: details.filter((d) => d.quality !== 'good').length,
    details,
    timestamp: new Date().toISOString(),
  }
}

export async function getData(ids: string[], start: number, end: number): Promise<{ data: Record<string, Array<{ t: number; v: number }>> }> {
  const span = end - start
  const step = Math.max(1000, Math.floor(span / 300))
  const points = Math.floor(span / step)
  const out: Record<string, Array<{ t: number; v: number }>> = {}
  ids.forEach((id, idx) => {
    const base = 50 + idx * 10
    const arr: Array<{ t: number; v: number }> = []
    for (let i = 0; i <= points; i++) {
      const t = start + i * step
      const noise = Math.sin(i / 10 + idx) * 5 + (Math.random() - 0.5) * 2
      arr.push({ t, v: +(base + noise).toFixed(2) })
    }
    out[id] = arr
  })
  return { data: out }
}

export async function getEvents(refIds: string[], start: number, end: number): Promise<EventItem[]> {
  const ts = dayjs(start)
  const events: EventItem[] = [
    { id: 1, title: '更换Z轴驱动器', ref_id: 'POAM1.Z', event_time: ts.add(1, 'minute').toISOString(), category: 'maintenance', description: '例行维护' },
    { id: 2, title: '主电流异常报警', ref_id: 'POAM1.Z.MA', event_time: ts.add(2, 'minute').toISOString(), category: 'fault', description: '值超阈' },
    { id: 3, title: '校准主轴传感器', ref_id: 'POAM1', event_time: ts.add(6, 'minute').toISOString(), category: 'calibration', description: '年度校准' },
  ]
  return events.filter((e) => {
    const t = dayjs(e.event_time).valueOf()
    return t >= start && t <= end && refIds.some((r) => e.ref_id.startsWith(r))
  })
}

export function toMetricId(deviceId: string, axisId: string, metricId: string) {
  return `${deviceId}.${axisId}.${metricId}`
}
