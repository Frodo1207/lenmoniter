<template>
  <div class="dashboard-container">
    <div class="header-col">
      <div class="control-row">
        <div class="filter-group">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="muted" style="white-space:nowrap; flex-shrink: 0;">机台</span>
            <select class="select" v-model="localDeviceId" style="width:120px;">
              <option value="">全部机台</option>
              <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div style="width:1px; height:24px; background:var(--border); margin:0 8px;"></div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="muted" style="white-space:nowrap; flex-shrink: 0;">时间</span>
            <input type="datetime-local" class="input date-input" v-model="pickerStart" />
            <span class="muted">-</span>
            <input type="datetime-local" class="input date-input" v-model="pickerEnd" />
            <button class="btn" @click="handleQuery" :disabled="isLoading">
              <span v-if="isLoading">加载中...</span>
              <span v-else>查询</span>
            </button>
          </div>
        </div>
      </div>
      
      <div class="quick-row">
        <div class="btn-group">
          <button class="btn secondary" @click="quick(10)">近10分</button>
          <button class="btn secondary" @click="quick(60)">近1小时</button>
          <button class="btn secondary" @click="quick(6 * 60)">近6小时</button>
          <button class="btn secondary" @click="quick(24 * 60)">近24小时</button>
        </div>
      </div>
    </div>
    
    <div class="grid-wrapper">
      <TransitionGroup name="chart-list" tag="div" class="chart-grid">
        <ChartContainer 
          v-for="(c, i) in charts" 
          :key="c.id" 
          :metric-ids="deviceId ? c.metrics.filter(m => m.startsWith(deviceId + '.')) : c.metrics" 
          :time-range="activeTimeRange"
          :is-active="i === currentIndex"
          @activate="$emit('update:currentIndex', i)"
          @delete="$emit('deleteChart', i)"
          @dragstart="onDragStart(i)"
          @dragenter="onDragEnter(i)"
          @dragover.prevent
        />
      </TransitionGroup>
      
      <!-- Loading Overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">数据加载中...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import ChartContainer from './ChartContainer.vue'
import { getDevices } from '../services/request'
import type { Device } from '../services/request'

export type ChartDef = { id: string; metrics: string[] }

const props = defineProps<{ 
  charts: ChartDef[];
  currentIndex: number;
  deviceId: string;
}>()

const emit = defineEmits<{
  (e: 'update:currentIndex', idx: number): void;
  (e: 'deleteChart', idx: number): void;
  (e: 'update:deviceId', id: string): void;
  (e: 'reorder', from: number, to: number): void;
}>()

// Internal picker state (strings for input)
const pickerStart = ref('')
const pickerEnd = ref('')

const devices = ref<Device[]>([])
const localDeviceId = ref(props.deviceId)
const dragSrcIndex = ref<number | null>(null)

function onDragStart(i: number) {
  dragSrcIndex.value = i
}

function onDragEnter(i: number) {
  if (dragSrcIndex.value !== null && dragSrcIndex.value !== i) {
    const item = props.charts[dragSrcIndex.value]
    // We cannot mutate props directly, but wait, charts is a prop ref array object.
    // Vue 3 props are readonly proxy. We should emit an update or use a local copy.
    // However, for this specific request, usually we would need to emit 'update:charts'.
    // But since the parent passed charts as a ref, modifying the array inside *might* work if it's reactive 
    // but it's bad practice.
    // Let's check App.vue. It passes :charts="charts".
    // Better way: emit event to parent to swap.
    // But for drag sorting, real-time swap is needed.
    // Let's try to mutate the array via a method exposed or emit.
    // Actually, simply emitting update won't work well for dragover frequency.
    // Let's assume we can emit a 'reorder' event.
    emit('reorder', dragSrcIndex.value, i)
    dragSrcIndex.value = i
  }
}

// Active time range passed to charts
const activeTimeRange = reactive<{ start: number; end: number }>({ 
  start: Date.now() - 10 * 60_000, 
  end: Date.now() 
})

const isLoading = ref(false)

// Init inputs
onMounted(() => {
  syncInputs(activeTimeRange.start, activeTimeRange.end)
  getDevices().then(list => {
    devices.value = list
    // Do not force select first device, allow empty (All)
  })
})

function syncInputs(start: number, end: number) {
  pickerStart.value = dayjs(start).format('YYYY-MM-DDTHH:mm')
  pickerEnd.value = dayjs(end).format('YYYY-MM-DDTHH:mm')
}

async function handleQuery() {
  const s = dayjs(pickerStart.value).valueOf()
  const e = dayjs(pickerEnd.value).valueOf()
  
  if (isNaN(s) || isNaN(e) || s >= e) {
    alert('时间范围无效')
    return
  }

  isLoading.value = true
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800))
  
  activeTimeRange.start = s
  activeTimeRange.end = e
  isLoading.value = false
}

function quick(mins: number) {
  const end = Date.now()
  const start = end - mins * 60_000
  syncInputs(start, end)
  handleQuery()
}

defineExpose({ timeRange: activeTimeRange })

watch(() => props.deviceId, v => { localDeviceId.value = v })
watch(localDeviceId, v => { emit('update:deviceId', v) })
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-row {
  display: flex;
  align-items: center;
}

.date-input {
  padding: 6px 10px;
  font-family: inherit;
  width: 200px;
}

.grid-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 14, 20, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  border-radius: var(--radius);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.3);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.loading-text {
  color: var(--primary);
  font-weight: 500;
  letter-spacing: 0.05em;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
