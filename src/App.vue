<template>
  <div class="app-layout">
    <div class="topbar">
      <div style="font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--primary);">Lens</span>Monitor
      </div>
      <div class="tabs" style="margin-left: 32px;">
        <div class="tab" :class="{ active: tab==='monitor' }" @click="tab='monitor'">
          <span>数据监控</span>
        </div>
        <div class="tab" :class="{ active: tab==='events' }" @click="tab='events'">
          <span>事件记录</span>
        </div>
        <div class="tab" :class="{ active: tab==='report' }" @click="tab='report'">
          <span>报告导出</span>
        </div>
      </div>
    </div>

    <div class="content" v-if="tab==='monitor'">
      <div class="sidebar">
        <div class="sidebar-content">
          <MetricTreeSelector @addSelected="addToCurrent" @createChart="createChart" />
          <div style="margin-top: 16px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">图表列表</div>
          <div class="chart-list">
            <div v-for="(c, i) in charts" :key="c.id" 
              class="chart-list-item" 
              :class="{ active: current === i }"
              @click="current=i">
              <div class="chart-list-name">图表 {{ i+1 }}</div>
              <div class="chart-list-meta">{{ c.metrics.length }} 个指标</div>
            </div>
          </div>
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border);">
            <div class="section-title">图表管理</div>
            <div class="card" style="padding: 12px;">
              <div style="font-size: 0.9rem; margin-bottom: 12px;">当前选中: <b style="color: var(--text);">图表 {{ current + 1 }}</b></div>
              <div class="btn-group">
                <button class="btn secondary" style="flex: 1;" @click="createChart">新建</button>
                <button class="btn danger" style="flex: 1;" @click="removeChart(current)" :disabled="charts.length===0">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="main">
        <DashboardLayout 
          :charts="charts" 
          :current-index="current"
          @update:current-index="(val: number) => current = val"
          @delete-chart="removeChart"
          ref="dashRef" 
        />
      </div>
    </div>

    <div class="content" v-else-if="tab==='events'">
      <div class="sidebar">
        <div class="sidebar-content">
          <div class="section-title">录入事件</div>
          <div class="card">
            <div style="display:flex; flex-direction: column; gap:12px;">
              <div>
                <label class="form-label">标题</label>
                <input class="input" v-model="form.title" placeholder="事件标题..." />
              </div>
              <div>
                <label class="form-label">关联对象 ID</label>
                <input class="input" v-model="form.ref_id" placeholder="例如 POAM1.Z" />
              </div>
              <div>
                <label class="form-label">分类</label>
                <select class="select" v-model="form.category">
                  <option value="maintenance">维护</option>
                  <option value="fault">故障</option>
                  <option value="calibration">校准</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label class="form-label">描述</label>
                <textarea class="input" v-model="form.description" rows="3" placeholder="可选详细描述..."></textarea>
              </div>
              <div class="btn-group" style="margin-top: 4px;">
                <button class="btn" style="flex: 1;" @click="addEvent">添加</button>
                <button class="btn secondary" @click="resetEventForm">重置</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="main">
        <div class="section-title">事件列表</div>
        <div class="event-list">
          <div class="card event-card" v-for="e in events" :key="e.id">
            <div class="event-header">
              <span class="badge" :class="e.category">{{ e.category }}</span>
              <span class="event-time">{{ new Date(e.event_time).toLocaleString() }}</span>
            </div>
            <div class="event-title">{{ e.title }}</div>
            <div class="event-ref">Ref: <code>{{ e.ref_id }}</code></div>
            <div class="event-desc" v-if="e.description">{{ e.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="content" v-else>
      <div class="main">
        <div style="max-width: 600px; margin: 0 auto;">
          <div class="section-title">导出报告</div>
          <div class="card">
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 500; margin-bottom: 4px;">当前时间范围</div>
              <div class="muted">{{ new Date(dashRef?.timeRange.start ?? Date.now()).toLocaleString() }} - {{ new Date(dashRef?.timeRange.end ?? Date.now()).toLocaleString() }}</div>
            </div>
            
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 500; margin-bottom: 4px;">摘要</div>
              <div class="muted">{{ charts.length }} 个图表, {{ events.length }} 条相关事件</div>
            </div>

            <div class="btn-group">
              <button class="btn" @click="exportReport">下载 PDF 报告</button>
            </div>
            
            <div v-if="exportInfo" class="alert-success" style="margin-top: 16px;">
              {{ exportInfo }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MetricTreeSelector from './components/MetricTreeSelector.vue'
import DashboardLayout from './components/DashboardLayout.vue'
import type { ChartDef } from './components/DashboardLayout.vue'

type Tab = 'monitor' | 'events' | 'report'
const tab = ref<Tab>('monitor')

const charts = ref<ChartDef[]>([{ id: 'chart-1', metrics: ['POAM1.Z.MA'] }])
const current = ref(0)
const currentChartName = computed(() => charts.value[current.value]?.id ?? '（无）')
const dashRef = ref<InstanceType<typeof DashboardLayout> | null>(null)

function addToCurrent(ids: string[]) {
  if (charts.value.length === 0) createChart()
  const set = new Set(charts.value[current.value].metrics)
  ids.forEach((id) => set.add(id))
  charts.value[current.value].metrics = Array.from(set)
}

function createChart() {
  charts.value.push({ id: `chart-${charts.value.length + 1}`, metrics: [] })
  current.value = charts.value.length - 1
}

function removeChart(index: number) {
  charts.value.splice(index, 1)
  if (charts.value.length === 0) {
    current.value = 0
  } else {
    // If we removed the current chart or a previous one, adjust current
    if (index <= current.value) {
      current.value = Math.max(0, current.value - 1)
    }
  }
}

// events mock storage
let eventSeq = 100
const events = ref<Array<{ id: number; title: string; description?: string; ref_id: string; event_time: string; category: string }>>([])

const form = ref({ title: '', description: '', ref_id: 'POAM1.Z', category: 'maintenance' })
function addEvent() {
  if (!form.value.title.trim()) return
  events.value.push({ id: eventSeq++, title: form.value.title, description: form.value.description, ref_id: form.value.ref_id, category: form.value.category, event_time: new Date().toISOString() })
  resetEventForm()
}
function resetEventForm() {
  form.value = { title: '', description: '', ref_id: 'POAM1.Z', category: 'maintenance' }
}

const exportInfo = ref('')
function exportReport() {
  exportInfo.value = `报告生成成功（Mock）：包含 ${charts.value.length} 个图表，时间窗 ${new Date(dashRef.value?.timeRange.start ?? Date.now()).toLocaleTimeString()} - ${new Date(dashRef.value?.timeRange.end ?? Date.now()).toLocaleTimeString()}`
}
</script>

<style scoped>
.chart-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chart-list-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  transition: all 0.2s;
}
.chart-list-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.chart-list-item.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
}
.chart-list-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text);
}
.chart-list-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.form-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.event-card {
  border-left: 3px solid transparent;
}
.event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}
.badge.fault { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.badge.maintenance { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.badge.calibration { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
.badge.other { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }

.event-time { font-size: 0.8rem; color: var(--text-secondary); }
.event-title { font-weight: 600; font-size: 1rem; margin-bottom: 4px; }
.event-ref { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; }
.event-ref code { background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
.event-desc { font-size: 0.9rem; color: var(--text); opacity: 0.9; line-height: 1.4; }

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
  padding: 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
