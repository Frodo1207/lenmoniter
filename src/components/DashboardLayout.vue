<template>
  <div class="dashboard-container">
    <div class="header-row">
      <div class="control-group">
        <div class="section-title" style="margin: 0;">时间范围</div>
        <div class="date-picker-group">
          <input type="datetime-local" class="input date-input" v-model="pickerStart" />
          <span class="muted">-</span>
          <input type="datetime-local" class="input date-input" v-model="pickerEnd" />
          <button class="btn" @click="handleQuery" :disabled="isLoading">
            <span v-if="isLoading">加载中...</span>
            <span v-else>查询</span>
          </button>
        </div>
      </div>
      
      <div class="btn-group">
        <button class="btn secondary" @click="quick(10)">近10分</button>
        <button class="btn secondary" @click="quick(60)">近1小时</button>
        <button class="btn secondary" @click="quick(6 * 60)">近6小时</button>
        <button class="btn secondary" @click="quick(24 * 60)">近24小时</button>
      </div>
    </div>
    
    <div class="grid-wrapper">
      <div class="chart-grid">
        <ChartContainer 
          v-for="(c, i) in charts" 
          :key="c.id" 
          :metric-ids="c.metrics" 
          :time-range="activeTimeRange"
          :is-active="i === currentIndex"
          @activate="$emit('update:currentIndex', i)"
          @delete="$emit('deleteChart', i)"
        />
      </div>
      
      <!-- Loading Overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">数据加载中...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import dayjs from 'dayjs'
import ChartContainer from './ChartContainer.vue'

export type ChartDef = { id: string; metrics: string[] }

const props = defineProps<{ 
  charts: ChartDef[];
  currentIndex: number;
}>()

const emit = defineEmits<{
  (e: 'update:currentIndex', idx: number): void;
  (e: 'deleteChart', idx: number): void;
}>()

// Internal picker state (strings for input)
const pickerStart = ref('')
const pickerEnd = ref('')

// Active time range passed to charts
const activeTimeRange = reactive<{ start: number; end: number }>({ 
  start: Date.now() - 10 * 60_000, 
  end: Date.now() 
})

const isLoading = ref(false)

// Init inputs
onMounted(() => {
  syncInputs(activeTimeRange.start, activeTimeRange.end)
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
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.date-picker-group {
  display: flex;
  align-items: center;
  gap: 8px;
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
