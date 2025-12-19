<template>
  <div class="timeline-container">
    <div class="timeline">
      <div
        v-for="e in events"
        :key="e.id"
        class="marker-wrapper"
        :style="{ left: pos(e) + '%' }"
      >
        <div class="marker" :class="e.category"></div>
        <div class="tooltip">
          <div class="tooltip-header">
            <span class="badge" :class="e.category">{{ e.category }}</span>
            <span class="time">{{ dayjs(e.event_time).format('HH:mm:ss') }}</span>
          </div>
          <div class="tooltip-title">{{ e.title }}</div>
        </div>
      </div>
    </div>
    <div class="timeline-meta" v-if="events.length > 0">
      <span class="count">{{ events.length }} 事件</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { EventItem } from '../services/request'

const props = defineProps<{ events: EventItem[]; start: number; end: number }>()

function pos(e: EventItem) {
  const t = dayjs(e.event_time).valueOf()
  const span = props.end - props.start
  return Math.max(0, Math.min(100, ((t - props.start) / span) * 100))
}
</script>

<style scoped>
.timeline-container {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
}

.timeline {
  flex: 1;
  height: 8px;
  position: relative;
  background: #1f2937;
  border-radius: 4px;
  margin: 0 4px;
}

.timeline-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.marker-wrapper {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  cursor: pointer;
}

.marker {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-secondary);
  border: 2px solid #1f2937;
  transition: all 0.2s;
}

.marker.fault { background: var(--danger); }
.marker.maintenance { background: var(--success); }
.marker.calibration { background: var(--warning); }
.marker.other { background: var(--primary); }

.marker-wrapper:hover .marker {
  transform: scale(1.4);
  box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
}

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  background: #1f2937;
  border: 1px solid var(--border);
  padding: 8px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  box-shadow: var(--shadow);
  z-index: 20;
  min-width: 140px;
}

.marker-wrapper:hover .tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(-12px);
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 0.7rem;
}

.tooltip-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text);
}

.badge {
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  font-size: 0.65rem;
  font-weight: 600;
  background: #374151;
  color: #d1d5db;
}
.badge.fault { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.badge.maintenance { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.badge.calibration { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }

.time { color: var(--text-secondary); }
</style>
