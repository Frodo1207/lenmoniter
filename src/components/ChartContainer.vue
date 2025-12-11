<template>
  <div class="card chart-box" :class="{ active: isActive }" @click="$emit('activate')">
    <div class="chart-header">
      <div style="font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
        <span class="tag" v-if="metricIds.length > 0">{{ metricIds.length }} 指标</span>
        <span v-else class="muted">空图表 (请添加指标)</span>
        <span v-if="metricIds.length <= 2" style="font-size: 0.85rem; color: var(--text-secondary);">{{ metricIds.join(', ') }}</span>
      </div>
      <button class="btn-icon danger" @click.stop="$emit('delete')" title="删除图表">
        <span>×</span>
      </button>
    </div>
    
    <div class="chart-body">
      <div ref="el" style="width: 100%; height: 100%;"></div>
    </div>
    
    <div class="chart-footer">
      <EventTimeline :events="events" :start="timeRange.start" :end="timeRange.end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { getData, getEvents, EventItem } from '../services/mock'
import EventTimeline from './EventTimeline.vue'

const props = defineProps<{ 
  metricIds: string[]; 
  timeRange: { start: number; end: number };
  isActive?: boolean;
}>()

const emit = defineEmits<{
  (e: 'activate'): void;
  (e: 'delete'): void;
}>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
const events = ref<EventItem[]>([])

async function refresh() {
  if (!chart || props.metricIds.length === 0) {
    if (chart) chart.clear()
    return
  }
  
  // Resize chart to fit new container size before rendering
  chart.resize()
  
  const { data } = await getData(props.metricIds, props.timeRange.start, props.timeRange.end)
  events.value = await getEvents(props.metricIds.map((id) => id.split('.').slice(0, 2).join('.')), props.timeRange.start, props.timeRange.end)
  const series = props.metricIds.map((id) => ({
    name: id,
    type: 'line' as const,
    showSymbol: false,
    smooth: true,
    lineStyle: { width: 2 },
    data: data[id]?.map((p) => [p.t, p.v]) ?? [],
  }))
  
  chart.setOption({
    animation: true,
    animationDuration: 300,
    backgroundColor: 'transparent',
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(21, 25, 33, 0.9)',
      borderColor: '#2e3646',
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => {
        const ts = params[0]?.data?.[0] ?? props.timeRange.start
        const near = nearestEvent(ts, 30000)
        let html = `<div style="font-size:12px; color:#94a3b8; margin-bottom:4px;">${new Date(ts).toLocaleString()}</div>`
        params.forEach((p: any) => {
          html += `<div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
            <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:50%; background:${p.color}"></span>${p.seriesName}</span>
            <b style="font-family:monospace;">${p.data[1]}</b>
          </div>`
        })
        if (near) {
          html += `<div style="margin-top:8px; padding-top:8px; border-top:1px solid #2e3646; color:#f59e0b;">
            <div style="font-weight:600; display:flex; align-items:center; gap:4px;">⚠️ ${near.title}</div>
            <div style="font-size:11px; opacity:0.8;">[${near.category}] ${new Date(near.event_time).toLocaleTimeString()}</div>
          </div>`
        }
        return html
      },
    },
    grid: { left: 10, right: 10, top: 30, bottom: 10, containLabel: true },
    legend: { top: 0, textStyle: { color: '#94a3b8' }, type: 'scroll' },
    xAxis: { 
      type: 'time', 
      axisLine: { lineStyle: { color: '#2e3646' } },
      axisLabel: { color: '#94a3b8', formatter: '{HH}:{mm}' },
      splitLine: { show: false }
    },
    yAxis: { 
      type: 'value', 
      splitLine: { lineStyle: { color: '#2e3646', type: 'dashed' } },
      axisLabel: { color: '#94a3b8' }
    },
    series,
  })
}

function nearestEvent(ts: number, windowMs: number) {
  let min = Infinity
  let ret: EventItem | null = null
  for (const e of events.value) {
    const t = new Date(e.event_time).getTime()
    const diff = Math.abs(t - ts)
    if (diff < min && diff <= windowMs) {
      min = diff
      ret = e
    }
  }
  return ret
}

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  window.addEventListener('resize', () => chart?.resize())
  refresh()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => chart?.resize())
  chart?.dispose()
  chart = null
})

watch(() => [props.metricIds.join(','), props.timeRange.start, props.timeRange.end], () => refresh())
</script>

<style scoped>
.chart-box {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border);
}

.chart-box.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), var(--shadow);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 1.2rem;
  line-height: 1;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.btn-icon.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}
</style>
