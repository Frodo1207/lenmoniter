# LensMonitor API 接口文档

默认后端前缀：`/api`  
本地开发默认地址：`http://127.0.0.1:5001/api`

前端可通过 `VITE_API_BASE` 指定后端地址（例如：`http://127.0.0.1:5001`），最终请求会拼成 `${VITE_API_BASE}/api/*`（见 `src/services/request.ts:16-22`）。

## 数据结构

### Device

```ts
type Device = {
  id: string
  name: string
}
```

### MetricMeta

```ts
type MetricMeta = {
  id: string
  name: string
  unit: string
  sourceType: 'http' | 'mqtt' | 'opcua'
  axisId: string
  axisName: string
}
```

### MetricTreeDevice

两层结构：`机台 -> 指标(KV)`（见 `backend/app.py:19-49`）。

```ts
type MetricTreeDevice = {
  id: string
  name: string
  metrics: MetricMeta[]
}
```

### 指标 ID（MetricId）

前端使用 `${deviceId}.${metricKey}` 生成（见 `src/services/request.ts:85-87`）：

```ts
toMetricId(deviceId: string, metricKey: string) => `${deviceId}.${metricKey}`
```

其中 `metricKey` 来自 `MetricMeta.id`（例如 `Z.MA`），因此完整指标 ID 形如：`POAM1.Z.MA`。

### CollectDetail

```ts
type CollectDetail = {
  id: string
  quality: 'good' | 'timeout' | 'bad' | 'parse_error' | 'source_error'
  reason?: string
  value: number | null
  duration_ms: number
}
```

### EventItem

```ts
type EventItem = {
  id: number
  title: string
  description?: string
  ref_id: string
  event_time: string // ISO8601，UTC，结尾 "Z"
  category: 'maintenance' | 'fault' | 'calibration' | 'other'
}
```

说明：
- `GET /api/events` 会返回“手动事件 + 自动生成事件”的合并结果（见 `backend/app.py:223-243`）。
- 自动生成事件 `id` 为负数；手动事件 `id` 为递增的正数（见 `backend/app.py:52-55`、`backend/app.py:106-143`、`backend/app.py:245-269`）。
- `PUT /api/events/<id>` 如果本地不存在该 `id`，会创建一个同 `id` 的手动事件，用于覆盖自动生成事件（见 `backend/app.py:271-307`）。

### ReportRequestChart / ReportResponse

```ts
type ReportRequestChart = {
  id: string
  metrics: string[] // 指标 ID 数组，例如 ["POAM1.Z.MA", "POAM1.Rx.POS"]
}

type ReportResponse = {
  summary: string
  start: number
  end: number
  charts: number
  metrics: number
  events: number
}
```

## 接口列表

### GET `/api/health`

返回服务健康状态。

响应：
```json
{ "status": "ok", "time": "2025-01-01T00:00:00Z" }
```

### GET `/api/devices`

返回机台列表（由 `TREE` 派生，见 `backend/app.py:151-154`）。

响应：`Device[]`

### GET `/api/metric-tree`

返回指标树（两层结构，见 `backend/app.py:156-158`）。

响应：`MetricTreeDevice[]`

### GET `/api/metrics?deviceId=<string>`

按机台查询指标列表（见 `backend/app.py:161-168`）。

查询参数：
- `deviceId`：机台 ID（例如 `POAM1`）

响应：`MetricMeta[]`（找不到机台则返回 `[]`）

### POST `/api/collect`

模拟采集接口（见 `backend/app.py:170-197`）。

请求：
```json
{ "targets": ["POAM1.Z.MA", "POAM1.Rx.POS"] }
```

响应：
```json
{
  "success_count": 1,
  "failed_count": 1,
  "details": [
    { "id": "POAM1.Z.MA", "quality": "good", "reason": null, "value": 88.12, "duration_ms": 132 },
    { "id": "POAM1.Rx.POS", "quality": "timeout", "reason": "mock_timeout", "value": null, "duration_ms": 5000 }
  ],
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### POST `/api/data`

获取曲线数据（见 `backend/app.py:199-221`）。

请求：
```json
{ "ids": ["POAM1.Z.MA"], "start": 1730000000000, "end": 1730000600000 }
```

响应：
```json
{
  "data": {
    "POAM1.Z.MA": [
      { "t": 1730000000000, "v": 52.31 },
      { "t": 1730000010000, "v": 53.02 }
    ]
  }
}
```

### GET `/api/events`

按时间范围、引用 ID 前缀过滤事件（见 `backend/app.py:223-243`）。

查询参数：
- `refIds`：可重复参数（例如 `refIds=POAM1`、`refIds=POAM1.Z`、`refIds=POAM1.Z.MA`），也支持逗号分隔（见 `backend/app.py:74-81`）
- `start`：毫秒时间戳
- `end`：毫秒时间戳

过滤规则：
- `ref_id` 以任意 `refIds` 前缀开头即匹配（见 `backend/app.py:83-87`）
- `refIds` 为空则返回全部

响应：`EventItem[]`

示例：
```bash
curl 'http://127.0.0.1:5001/api/events?refIds=POAM1&start=1730000000000&end=1730003600000'
```

### POST `/api/events`

创建手动事件（见 `backend/app.py:245-269`）。

请求：
```json
{
  "title": "更换部件",
  "description": "更换 Z 轴传感器",
  "ref_id": "POAM1.Z",
  "category": "maintenance",
  "event_time": "2025-01-01T00:00:00Z"
}
```

约束：
- `title`、`ref_id` 必填，否则返回 `400`（见 `backend/app.py:255-257`）
- `event_time` 可选，不传则使用当前时间（UTC）

响应：`EventItem`

### PUT `/api/events/<id>`

更新或覆盖事件（见 `backend/app.py:271-307`）。

请求：支持任意字段的部分更新（见 `src/services/request.ts:77-79`）。

示例：
```json
{ "title": "通信超时（已确认）", "category": "fault" }
```

响应：`EventItem`

### POST `/api/report`

生成报告摘要（见 `backend/app.py:310-360`）。

请求：
```json
{
  "start": 1730000000000,
  "end": 1730003600000,
  "deviceId": "POAM1",
  "charts": [
    { "id": "chart-1", "metrics": ["POAM1.Z.MA", "POAM1.Rx.POS"] }
  ]
}
```

说明：
- 若传 `deviceId`，报告事件统计会按 `refIds=[deviceId]` 过滤。
- 未传 `deviceId` 时，会从 `charts[].metrics` 推导 `refIds`（取每个指标前两段拼接，如 `POAM1.Z`），用于事件统计（见 `backend/app.py:324-337`）。
- `start/end` 无效时会自动回退到近 10 分钟（见 `backend/app.py:318-322`）。

响应：`ReportResponse`

