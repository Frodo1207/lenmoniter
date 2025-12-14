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
          { id: 'VEL', name: 'Velocity', unit: 'mm/s', sourceType: 'opcua', axisId: 'Z', axisName: 'Z' },
        ],
      },
      {
        id: 'Rx',
        name: 'Rx',
        metrics: [
          { id: 'MA_3A', name: 'MA_3A', unit: 'A', sourceType: 'opcua', axisId: 'Rx', axisName: 'Rx' },
          { id: 'POS', name: 'Position', unit: 'deg', sourceType: 'mqtt', axisId: 'Rx', axisName: 'Rx' },
        ],
      },
      {
        id: 'Ry',
        name: 'Ry',
        metrics: [
          { id: 'TRQ', name: 'Torque', unit: 'Nm', sourceType: 'http', axisId: 'Ry', axisName: 'Ry' },
        ],
      },
    ],
  },
  {
    id: 'POAM2',
    name: 'POAM2',
    axes: [
      {
        id: 'X',
        name: 'X',
        metrics: [
          { id: 'CUR', name: 'Current', unit: 'A', sourceType: 'http', axisId: 'X', axisName: 'X' },
          { id: 'ERR', name: 'Error', unit: 'μm', sourceType: 'mqtt', axisId: 'X', axisName: 'X' },
        ],
      },
      {
        id: 'Y',
        name: 'Y',
        metrics: [
          { id: 'CUR', name: 'Current', unit: 'A', sourceType: 'http', axisId: 'Y', axisName: 'Y' },
        ],
      },
    ],
  },
  {
    id: 'LENS_TESTER',
    name: 'LENS_TESTER',
    axes: [
      {
        id: 'Main',
        name: 'Main',
        metrics: [
          { id: 'TEMP', name: 'Temperature', unit: '°C', sourceType: 'opcua', axisId: 'Main', axisName: 'Main' },
          { id: 'HUM', name: 'Humidity', unit: '%', sourceType: 'mqtt', axisId: 'Main', axisName: 'Main' },
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
  const pool: string[] = []
  tree.forEach((d) => {
    pool.push(d.id)
    d.axes.forEach((a) => {
      pool.push(`${d.id}.${a.id}`)
      a.metrics.forEach((m) => {
        pool.push(`${d.id}.${a.id}.${m.id}`)
      })
    })
  })
  const span = Math.max(1, end - start)
  const baseCount = Math.floor(span / 60000)
  const count = Math.max(12, Math.min(50, baseCount))
  const cats: Array<EventItem['category']> = ['maintenance', 'fault', 'calibration', 'other']
  const titles: Record<EventItem['category'], string[]> = {
    maintenance: ['例行维护', '更换部件', '润滑', '保养'],
    fault: ['异常报警', '传感器异常', '通信超时', '温度过高', '电流过高', '回零失败', '振动异常'],
    calibration: ['校准传感器', '轴校准', '定位标定', '周期校准'],
    other: ['巡检', '手动记录', '环境变更', '测试事件'],
  }
  const events: EventItem[] = []
  for (let i = 0; i < count; i++) {
    const t = start + Math.floor(Math.random() * span)
    const cat = cats[Math.floor(Math.random() * cats.length)]
    const titleList = titles[cat]
    const title = titleList[Math.floor(Math.random() * titleList.length)]
    const ref = pool[Math.floor(Math.random() * pool.length)]
    events.push({ id: i + 1, title, ref_id: ref, event_time: new Date(t).toISOString(), category: cat, description: undefined })
  }
  return events
    .filter((e) => {
      const t = dayjs(e.event_time).valueOf()
      return t >= start && t <= end && (refIds.length === 0 || refIds.some((r) => e.ref_id.startsWith(r)))
    })
    .sort((a, b) => dayjs(a.event_time).valueOf() - dayjs(b.event_time).valueOf())
}

export function toMetricId(deviceId: string, axisId: string, metricId: string) {
  return `${deviceId}.${axisId}.${metricId}`
}
