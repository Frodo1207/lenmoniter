from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


MetricTreeDevice = Dict[str, Any]


TREE: List[MetricTreeDevice] = [
    {
        "id": "POAM1",
        "name": "POAM1",
        "metrics": [
            {"id": "Z.MA", "name": "MA", "unit": "A", "sourceType": "http", "axisId": "Z", "axisName": "Z"},
            {"id": "Z.MSD", "name": "MSD", "unit": "μm", "sourceType": "mqtt", "axisId": "Z", "axisName": "Z"},
            {"id": "Z.VEL", "name": "Velocity", "unit": "mm/s", "sourceType": "opcua", "axisId": "Z", "axisName": "Z"},
            {"id": "Rx.MA_3A", "name": "MA_3A", "unit": "A", "sourceType": "opcua", "axisId": "Rx", "axisName": "Rx"},
            {"id": "Rx.POS", "name": "Position", "unit": "deg", "sourceType": "mqtt", "axisId": "Rx", "axisName": "Rx"},
            {"id": "Ry.TRQ", "name": "Torque", "unit": "Nm", "sourceType": "http", "axisId": "Ry", "axisName": "Ry"},
        ],
    },
    {
        "id": "POAM2",
        "name": "POAM2",
        "metrics": [
            {"id": "X.CUR", "name": "Current", "unit": "A", "sourceType": "http", "axisId": "X", "axisName": "X"},
            {"id": "X.ERR", "name": "Error", "unit": "μm", "sourceType": "mqtt", "axisId": "X", "axisName": "X"},
            {"id": "Y.CUR", "name": "Current", "unit": "A", "sourceType": "http", "axisId": "Y", "axisName": "Y"},
        ],
    },
    {
        "id": "LENS_TESTER",
        "name": "LENS_TESTER",
        "metrics": [
            {"id": "Main.TEMP", "name": "Temperature", "unit": "°C", "sourceType": "opcua", "axisId": "Main", "axisName": "Main"},
            {"id": "Main.HUM", "name": "Humidity", "unit": "%", "sourceType": "mqtt", "axisId": "Main", "axisName": "Main"},
        ],
    },
]


EVENTS: List[Dict[str, Any]] = []
EVENT_SEQ = 1000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _stable_seed(s: str) -> int:
    h = hashlib.md5(s.encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _parse_ms(v: Optional[str], default: int) -> int:
    if v is None:
        return default
    try:
        return int(float(v))
    except ValueError:
        return default


def _parse_ref_ids() -> List[str]:
    out: List[str] = []
    for raw in request.args.getlist("refIds"):
        out.extend([x for x in raw.split(",") if x])
    for raw in request.args.getlist("refId"):
        out.extend([x for x in raw.split(",") if x])
    return list(dict.fromkeys([x.strip() for x in out if x.strip()]))


def _ref_match(ref_ids: List[str], ref_id: str) -> bool:
    if not ref_ids:
        return True
    return any(ref_id.startswith(r) for r in ref_ids)


def _event_pool() -> List[str]:
    pool: List[str] = []
    for d in TREE:
        pool.append(d["id"])
        axis_ids = set()
        for m in d.get("metrics") or []:
            axis_id = m.get("axisId")
            if axis_id:
                axis_ids.add(str(axis_id))
            metric_key = str(m.get("id") or "").strip()
            if metric_key:
                pool.append(f'{d["id"]}.{metric_key}')
        for axis_id in sorted(axis_ids):
            pool.append(f'{d["id"]}.{axis_id}')
    return pool


def _gen_events(ref_ids: List[str], start: int, end: int) -> List[Dict[str, Any]]:
    span = max(1, end - start)
    base_count = span // 60_000
    count = max(12, min(50, int(base_count)))

    cats = ["maintenance", "fault", "calibration", "other"]
    titles = {
        "maintenance": ["例行维护", "更换部件", "润滑", "保养"],
        "fault": ["异常报警", "传感器异常", "通信超时", "温度过高", "电流过高", "回零失败", "振动异常"],
        "calibration": ["校准传感器", "轴校准", "定位标定", "周期校准"],
        "other": ["巡检", "手动记录", "环境变更", "测试事件"],
    }

    pool = _event_pool()
    rng = random.Random(_stable_seed(f"events:{start}:{end}:{','.join(ref_ids)}"))
    out: List[Dict[str, Any]] = []
    for i in range(count):
        t = start + rng.randrange(span)
        cat = rng.choice(cats)
        title = rng.choice(titles[cat])
        ref = rng.choice(pool)
        out.append(
            {
                "id": -(i + 1),
                "title": title,
                "description": None,
                "ref_id": ref,
                "event_time": datetime.fromtimestamp(t / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                "category": cat,
            }
        )

    def to_ms(iso: str) -> int:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)

    out = [e for e in out if start <= to_ms(e["event_time"]) <= end and _ref_match(ref_ids, e["ref_id"])]
    out.sort(key=lambda x: x["event_time"])
    return out


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "time": _now_iso()})


@app.get("/api/devices")
def devices():
    return jsonify([{"id": d["id"], "name": d["name"]} for d in TREE])


@app.get("/api/metric-tree")
def metric_tree():
    return jsonify(TREE)


@app.get("/api/metrics")
def metrics():
    device_id = request.args.get("deviceId", "")
    dev = next((d for d in TREE if d["id"] == device_id), None)
    if not dev:
        return jsonify([])
    return jsonify([dict(m) for m in (dev.get("metrics") or [])])


@app.post("/api/collect")
def collect():
    body = request.get_json(silent=True) or {}
    targets = body.get("targets") or []
    rng = random.Random()
    details = []
    for metric_id in targets:
        ok = rng.random() > 0.15
        details.append(
            {
                "id": metric_id,
                "quality": "good" if ok else "timeout",
                "reason": None if ok else "mock_timeout",
                "value": round(50 + rng.random() * 50, 2) if ok else None,
                "duration_ms": int(80 + rng.random() * 180) if ok else 5000,
            }
        )
    success = sum(1 for d in details if d["quality"] == "good")
    failed = len(details) - success
    return jsonify(
        {
            "success_count": success,
            "failed_count": failed,
            "details": details,
            "timestamp": _now_iso(),
        }
    )


@app.post("/api/data")
def data():
    body = request.get_json(silent=True) or {}
    ids: List[str] = body.get("ids") or []
    start = int(body.get("start") or (int(datetime.now().timestamp() * 1000) - 10 * 60_000))
    end = int(body.get("end") or int(datetime.now().timestamp() * 1000))
    span = max(1, end - start)
    step = max(1000, span // 300)
    points = span // step

    out: Dict[str, List[Dict[str, Any]]] = {}
    for idx, metric_id in enumerate(ids):
        base = 50 + idx * 10
        rng = random.Random(_stable_seed(f"series:{metric_id}:{start}:{end}"))
        arr: List[Dict[str, Any]] = []
        for i in range(int(points) + 1):
            t = start + i * step
            noise = math.sin(i / 10 + idx) * 5 + (rng.random() - 0.5) * 2
            arr.append({"t": t, "v": round(base + noise, 2)})
        out[metric_id] = arr

    return jsonify({"data": out})


@app.get("/api/events")
def events():
    ref_ids = _parse_ref_ids()
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    start = _parse_ms(request.args.get("start"), now - 60 * 60_000)
    end = _parse_ms(request.args.get("end"), now)

    def to_ms(iso: str) -> int:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)

    local = [e for e in EVENTS if start <= to_ms(e["event_time"]) <= end and _ref_match(ref_ids, e["ref_id"])]
    generated = _gen_events(ref_ids, start, end)
    
    # Filter out generated events that have been overridden (exist in EVENTS with same ID)
    overridden_ids = {e["id"] for e in EVENTS}
    generated = [g for g in generated if g["id"] not in overridden_ids]

    merged = [*local, *generated]
    merged.sort(key=lambda x: x["event_time"])
    return jsonify(merged)


@app.post("/api/events")
def create_event():
    global EVENT_SEQ
    body = request.get_json(silent=True) or {}
    title = str(body.get("title") or "").strip()
    ref_id = str(body.get("ref_id") or "").strip()
    category = str(body.get("category") or "other").strip() or "other"
    description = body.get("description")
    event_time = str(body.get("event_time") or _now_iso()).strip() or _now_iso()

    if not title or not ref_id:
        return jsonify({"error": "title 和 ref_id 为必填"}), 400

    item = {
        "id": EVENT_SEQ,
        "title": title,
        "description": description,
        "ref_id": ref_id,
        "event_time": event_time,
        "category": category,
    }
    EVENT_SEQ += 1
    EVENTS.append(item)
    return jsonify(item), 201


@app.put("/api/events/<int:event_id>")
def update_event(event_id):
    body = request.get_json(silent=True) or {}
    
    # Find event
    idx = next((i for i, e in enumerate(EVENTS) if e["id"] == event_id), -1)
    
    if idx == -1:
        # If not found in manual events, create a new one (overriding generated or just new)
        # We accept the ID passed in path to maintain "identity" of the edited event
        item = {
            "id": event_id,
            "title": str(body.get("title") or "").strip(),
            "description": body.get("description"),
            "ref_id": str(body.get("ref_id") or "").strip(),
            "event_time": str(body.get("event_time") or _now_iso()).strip(),
            "category": str(body.get("category") or "other").strip(),
        }
        EVENTS.append(item)
        return jsonify(item)

    item = EVENTS[idx]
    
    # Update fields if provided
    if "title" in body:
        item["title"] = str(body["title"]).strip()
    if "description" in body:
        item["description"] = body["description"]
    if "ref_id" in body:
        item["ref_id"] = str(body["ref_id"]).strip()
    if "category" in body:
        item["category"] = str(body["category"]).strip()
    if "event_time" in body:
        item["event_time"] = str(body["event_time"]).strip()

    EVENTS[idx] = item
    return jsonify(item)


@app.post("/api/report")
def report():
    body = request.get_json(silent=True) or {}
    start = int(body.get("start") or 0)
    end = int(body.get("end") or 0)
    device_id = str(body.get("deviceId") or "").strip()
    charts = body.get("charts") or []

    if not start or not end or start >= end:
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        start = start or (now - 10 * 60_000)
        end = end or now

    metric_total = 0
    ref_ids: List[str] = []
    if device_id:
        ref_ids = [device_id]
    else:
        seen = set()
        for c in charts:
            metrics = c.get("metrics") or []
            metric_total += len(metrics)
            for m in metrics:
                parts = str(m).split(".")
                if len(parts) >= 2:
                    seen.add(".".join(parts[:2]))
        ref_ids = sorted(seen)

    def to_ms(iso: str) -> int:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)

    local = [e for e in EVENTS if start <= to_ms(e["event_time"]) <= end and _ref_match(ref_ids, e["ref_id"])]
    generated = _gen_events(ref_ids, start, end)
    overridden_ids = {e["id"] for e in EVENTS}
    generated = [g for g in generated if g["id"] not in overridden_ids]
    merged = [*local, *generated]
    merged.sort(key=lambda x: x["event_time"])

    chart_count = len(charts)
    metric_total = metric_total or sum(len((c.get("metrics") or [])) for c in charts)
    summary = f"报告已生成：图表 {chart_count} 个，指标 {metric_total} 个，事件 {len(merged)} 条"
    return jsonify(
        {
            "summary": summary,
            "start": start,
            "end": end,
            "charts": chart_count,
            "metrics": metric_total,
            "events": len(merged),
        }
    )



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
