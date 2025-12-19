<template>
  <div class="selector-container">
    <div class="section-title">指标选择</div>
    <div class="tree-wrapper">
      <div v-for="dev in visibleDevices" :key="dev.id" class="device-group">
        <div class="tree-node device-node" @click="toggle(dev.id)">
          <span class="icon">{{ expanded[dev.id] ? '▼' : '▶' }}</span>
          <span class="label">{{ dev.name }}</span>
          <span class="muted code">{{ dev.id }}</span>
        </div>
        
        <div v-show="expanded[dev.id]" class="tree-children">
          <div v-for="m in dev.metrics" :key="m.id" class="metric-node">
            <label class="custom-checkbox">
              <input type="checkbox" :value="toMetricId(dev.id, m.id)" v-model="localSelected" />
              <span class="checkmark"></span>
              <span class="metric-name">{{ m.axisName }} · {{ m.name }}</span>
              <span class="metric-code">{{ toMetricId(dev.id, m.id) }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <div class="selection-info" v-if="localSelected.length > 0">
        已选 {{ localSelected.length }} 项
      </div>
      <div class="btn-group">
        <button class="btn" @click="emitSelected" :disabled="localSelected.length === 0">添加到当前图表</button>
        <button class="btn secondary" @click="$emit('createChart')">新建图表</button>
        <button class="btn danger" @click="clear" :disabled="localSelected.length === 0">清空</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { getMetricTree, MetricTreeDevice, toMetricId } from '../services/request'

const props = defineProps<{ deviceId?: string }>()
const devices = ref<MetricTreeDevice[]>([])
const localSelected = ref<string[]>([])
const expanded = reactive<Record<string, boolean>>({})

onMounted(async () => {
  devices.value = await getMetricTree()
  // Default expand all
  devices.value.forEach(d => expanded[d.id] = true)
})

function toggle(id: string) {
  expanded[id] = !expanded[id]
}

const emit = defineEmits<{ (e: 'addSelected', ids: string[]): void; (e: 'createChart'): void }>()

function emitSelected() {
  emit('addSelected', [...localSelected.value])
}

function clear() {
  localSelected.value = []
}

defineExpose({ toMetricId })

const visibleDevices = computed(() => {
  if (!props.deviceId) return devices.value
  return devices.value.filter(d => d.id === props.deviceId)
})
</script>

<style scoped>
.selector-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tree-wrapper {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  padding-right: 8px;
}

.device-group {
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.device-node {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  font-size: 0.9rem;
}
.device-node:hover { background: rgba(255, 255, 255, 0.08); }

.tree-children {
  
}

.metric-node {
  padding: 4px 12px 4px 20px;
}

.custom-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}
.custom-checkbox:hover {
  background: rgba(255, 255, 255, 0.05);
}

.custom-checkbox input {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: #1f2937;
  position: relative;
  flex-shrink: 0;
}

.custom-checkbox input:checked + .checkmark {
  background: var(--primary);
  border-color: var(--primary);
}

.custom-checkbox input:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.metric-name {
  font-size: 0.9rem;
  color: var(--text);
}

.metric-code {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: auto;
  font-family: monospace;
  opacity: 0.7;
}

.code {
  font-family: monospace;
  font-size: 0.8em;
  opacity: 0.8;
}

.icon {
  width: 12px;
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.action-bar {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.selection-info {
  font-size: 0.8rem;
  color: var(--primary);
  margin-bottom: 8px;
  font-weight: 500;
}
</style>
