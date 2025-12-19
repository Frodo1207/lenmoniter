<template>
  <div 
    class="card chart-box" 
    :class="{ active: isActive }" 
    @click="$emit('activate')"
    :draggable="canDrag"
    @mousedown="checkDrag"
  >
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
      <div ref="el" class="chart-el"></div>
    </div>
    
    <div class="chart-footer">
      <div class="footer-row">
        <EventTimeline 
          :events="visibleEvents" 
          :start="currentZoomRange?.start ?? timeRange.start" 
          :end="currentZoomRange?.end ?? timeRange.end" 
        />
        <button class="btn small" @click.stop="expanded = !expanded" :disabled="visibleEvents.length === 0">
          <span v-if="!expanded">展开事件</span>
          <span v-else>收起事件</span>
          <span class="count-badge" v-if="visibleEvents.length > 0">{{ visibleEvents.length }}</span>
        </button>
      </div>
      <div v-if="expanded" class="event-panel">
        <div class="event-timeline-list">
          <div class="event-timeline-item" v-for="e in visibleEvents" :key="'ev-' + e.id">
            <div class="timeline-left">
              <div class="timeline-dot" :class="e.category"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="event-item-header">
                <span class="device-tag">{{ e.ref_id.split('.')[0] }}</span>
                <span class="time">{{ new Date(e.event_time).toLocaleString() }}</span>
                <span class="badge" :class="e.category">{{ e.category }}</span>
              </div>
              <div class="event-item-title">{{ e.title }}</div>
              <div class="event-item-desc muted">{{ e.description || '-' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { getData, getEvents, EventItem } from '../services/request'
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
const expanded = ref(false)
const currentZoomRange = ref<{start: number; end: number} | null>(null)
const canDrag = ref(false)

function checkDrag(e: MouseEvent) {
  // Only allow drag if clicking on header but NOT on buttons/inputs
  const target = e.target as HTMLElement
  if (target.closest('.chart-header') && !target.closest('button') && !target.closest('input')) {
    canDrag.value = true
  } else {
    canDrag.value = false
  }
}

const visibleEvents = computed(() => {
  if (!currentZoomRange.value) return events.value
  const { start, end } = currentZoomRange.value
  return events.value.filter(e => {
    const t = new Date(e.event_time).getTime()
    return t >= start && t <= end
  })
})

async function refresh() {
  if (!chart || props.metricIds.length === 0) {
    if (chart) chart.clear()
    return
  }
  
  try {
    chart.resize()

    const { data } = await getData(props.metricIds, props.timeRange.start, props.timeRange.end)
    events.value = await getEvents(props.metricIds.map((id) => id.split('.').slice(0, 2).join('.')), props.timeRange.start, props.timeRange.end)
    currentZoomRange.value = { start: props.timeRange.start, end: props.timeRange.end }
    const markLineData = events.value.map(e => ({
      xAxis: new Date(e.event_time).getTime(),
      label: { formatter: '{b}', position: 'end' },
      lineStyle: { 
        color: e.category === 'fault' ? '#ef4444' : 
               e.category === 'maintenance' ? '#10b981' : 
               e.category === 'calibration' ? '#f59e0b' : '#3b82f6',
        type: 'dashed',
        width: 1
      },
      tooltip: {
         formatter: (p: any) => {
           return `
             <div style="font-weight:600; color:${p.color}">⚠️ ${e.title}</div>
             <div style="font-size:11px; margin-top:2px; opacity:0.9;">机台: ${e.ref_id.split('.')[0]}</div>
             <div style="font-size:11px; opacity:0.8;">${new Date(e.event_time).toLocaleString()}</div>
           `
         }
       }
     }))

    const series = props.metricIds.map((id, index) => ({
      name: id,
      type: 'line' as const,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 2 },
      data: data[id]?.map((p) => [p.t, p.v]) ?? [],
      markLine: index === 0 && markLineData.length > 0 ? {
        symbol: ['none', 'none'],
        label: { show: false },
        data: markLineData,
        silent: false
      } : undefined
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
      grid: { left: 10, right: 10, top: 30, bottom: 25, containLabel: true },
      legend: { top: 0, textStyle: { color: '#94a3b8' }, type: 'scroll' },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        { type: 'slider', xAxisIndex: 0, filterMode: 'filter', height: 15, bottom: 5, borderColor: 'transparent', backgroundColor: '#1e293b', fillerColor: 'rgba(59, 130, 246, 0.2)', textStyle: { color: '#94a3b8' } }
      ],
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
    }, { notMerge: true })
  
    chart.off('dataZoom')
    chart.on('dataZoom', () => {
      if (!chart) return
      const opt = chart.getOption() as any
      const startValue = opt.dataZoom?.[0]?.startValue
      const endValue = opt.dataZoom?.[0]?.endValue
      
      if (typeof startValue === 'number' && typeof endValue === 'number') {
         currentZoomRange.value = { start: startValue, end: endValue }
      } else {
         const model = (chart as any).getModel().getComponent('xAxis', 0)
         if (model && model.axis) {
           const start = model.axis.scale.getExtent()[0]
           const end = model.axis.scale.getExtent()[1]
           currentZoomRange.value = { start, end }
         }
      }
    })

    if (expanded.value && events.value.length === 0) expanded.value = false
  } catch {
    events.value = []
    expanded.value = false
    chart.clear()
  }
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

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  
  // Use ResizeObserver to detect container size changes (e.g. grid layout updates)
  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
  })
  resizeObserver.observe(el.value)

  const ensureInitialResize = () => {
    let frames = 0
    const tick = () => {
      if (!chart || !el.value) return
      const rect = el.value.getBoundingClientRect()
      if (rect.width > 10 && rect.height > 10) chart.resize()
      frames++
      if (frames < 30 && (rect.width <= 10 || rect.height <= 10)) {
        requestAnimationFrame(tick)
        return
      }
      if (frames < 3) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  ensureInitialResize()

  refresh()
})


onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})

watch(() => [props.metricIds.join(','), props.timeRange.start, props.timeRange.end], () => refresh())
</script>

<style scoped>
.device-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 6px;
}

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

.chart-footer {
  border-top: 1px solid var(--border);
  padding: 8px;
}

.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.count-badge {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.event-panel {
  margin-top: 12px;
  max-height: 250px;
  overflow-y: auto;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.event-timeline-list {
  display: flex;
  flex-direction: column;
}

.event-timeline-item {
  display: flex;
  gap: 12px;
  position: relative;
  padding-bottom: 16px;
}

.event-timeline-item:last-child {
  padding-bottom: 0;
}

.event-timeline-item:last-child .timeline-line {
  display: none;
}

.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
  padding-top: 4px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--text-secondary);
  z-index: 2;
}
.timeline-dot.fault { background: var(--danger); border-color: rgba(239, 68, 68, 0.3); }
.timeline-dot.maintenance { background: var(--success); border-color: rgba(16, 185, 129, 0.3); }
.timeline-dot.calibration { background: var(--warning); border-color: rgba(245, 158, 11, 0.3); }
.timeline-dot.other { background: var(--primary); border-color: rgba(59, 130, 246, 0.3); }

.timeline-line {
  flex: 1;
  width: 2px;
  background: var(--border);
  margin-top: 4px;
  min-height: 10px;
}

.timeline-content {
  flex: 1;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.chart-el {
  position: absolute;
  inset: 0;
}
</style>
