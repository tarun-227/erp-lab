"""Upload every case and sweep parameters through the real API (in-process).

Usage (from the project root):
  python scripts/robustness/sweep_api.py . <cases dir> report.jsonl [--quick] [--only name,name] [--extra file1|file2 ...]
  python scripts/robustness/summarize.py report.jsonl
--extra adds real recordings (files of one recording joined by "|", e.g. a .vhdr|.vmrk|.eeg set).
A call fails the test if it raises (HTTP 500 / unhandled exception / non-finite JSON) or returns 200 with
inconsistent content. Clean 4xx answers with a message are fine.
"""

import json
import math
import random
import sys
import time
import traceback
from pathlib import Path

root, cases_dir, report_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
args = sys.argv[4:]
QUICK = "--quick" in args
ONLY = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
EXTRA = args[args.index("--extra") + 1:] if "--extra" in args else []
sys.path.insert(0, str(root / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from erp_module.api import create_app  # noqa: E402

client = TestClient(create_app(), raise_server_exceptions=True)
HIGH_PASS = [0, 0.1, 0.3, 0.5, 1, 2, 5]
LOW_PASS = [5, 10, 15, 20, 30, 40, 60, 100, 0]
report = report_path.open("w", encoding="utf8")
stats = {"calls": 0, "crash": 0, "bad": 0, "4xx": 0}


def log(**kw):
    report.write(json.dumps(kw, default=str) + "\n")
    report.flush()


def finite(x):
    if isinstance(x, float):
        return math.isfinite(x)
    if isinstance(x, dict):
        return all(finite(v) for v in x.values())
    if isinstance(x, list):
        return all(finite(v) for v in x)
    return True


def call(case, what, method, url, **kw):
    stats["calls"] += 1
    t = time.perf_counter()
    try:
        res = getattr(client, method)(url, **kw)
    except Exception as err:
        stats["crash"] += 1
        log(case=case, what=what, result="CRASH", error=f"{type(err).__name__}: {err}"[:500], tb=traceback.format_exc()[-1500:], params=kw.get("json"))
        return None
    dt = time.perf_counter() - t
    if res.status_code >= 500:
        stats["crash"] += 1
        log(case=case, what=what, result="CRASH", status=res.status_code, body=res.text[:300], params=kw.get("json"))
        return None
    if res.status_code >= 400:
        stats["4xx"] += 1
        detail = res.json().get("detail")
        if not detail:
            stats["bad"] += 1
            log(case=case, what=what, result="BAD", why="4xx without a message", status=res.status_code)
        log(case=case, what=what, result="4xx", status=res.status_code, detail=str(detail)[:300], s=round(dt, 2), params=kw.get("json"))
        return res
    if dt > 8:
        log(case=case, what=what, result="SLOW", s=round(dt, 2), params=kw.get("json"))
    return res


def check_process(case, p, body):
    problems = []
    if not finite(body):
        problems.append("non-finite numbers")
    n = len(body["kept"])
    if len(body["labels"]) != n or len(body["trials"]) != n:
        problems.append("trial arrays disagree")
    if body["drop"]["kept"] != sum(body["kept"]):
        problems.append("drop.kept != kept")
    if sum(c["n_kept"] for c in body["conditions"]) != sum(body["kept"]):
        problems.append("condition n_kept do not add up")
    if body["times"] and not (abs(body["times"][0] - p["tmin"]) < 0.02 and abs(body["times"][-1] - p["tmax"]) < 0.02):
        problems.append(f"times {body['times'][0]}..{body['times'][-1]} vs {p['tmin']}..{p['tmax']}")
    if body["channel"] != p["channel"] and p["channel"] in body["ch_names"]:
        problems.append(f"channel {body['channel']} != {p['channel']}")
    for c in body["conditions"]:
        if c["n_kept"] and len(c["mean"]) != len(body["times"]):
            problems.append("mean length")
    if problems:
        stats["bad"] += 1
        log(case=case, what="process", result="BAD", why=problems, params=p)


def params_for(summary, names):
    codes = sorted(summary["event_counts"], key=lambda c: -summary["event_counts"][c])
    chans = summary["ch_names"]
    ch = "Pz" if "Pz" in chans else chans[len(chans) // 2]
    conds = [{"code": int(c), "name": names.get(c, f"Code {c}")[:60]} for c in codes[:2]]
    default = dict(conditions=conds, l_freq=0.1, h_freq=30, reference="average", tmin=-0.2, tmax=0.8, baseline=True,
                   baseline_start=-0.2, baseline_end=0.0, reject_uv=100, channel=ch, peak_start=0.25, peak_end=0.5, polarity="positive")
    grid = [default]

    def v(**kw):
        grid.append({**default, **kw})

    for hp in HIGH_PASS if not QUICK else [0, 1, 5]:
        for lp in LOW_PASS if not QUICK else [5, 30, 100, 0]:
            v(l_freq=hp, h_freq=lp)
    for ref in ["none", chans[0], chans[-1], "NOT_A_CHANNEL"]:
        v(reference=ref)
    for c in [chans[0], chans[-1], "NOT_A_CHANNEL"]:
        v(channel=c)
    v(conditions=conds[:1])
    v(conditions=[{"code": int(c), "name": f"c{c}"} for c in codes[:6]])
    v(conditions=[{"code": int(c), "name": f"c{c}"} for c in codes[:7]] if len(codes) > 6 else [{"code": i, "name": f"c{i}"} for i in range(7)])
    v(conditions=[{"code": 9999, "name": "absent"}])
    v(conditions=[{"code": int(codes[0]), "name": "same"}, {"code": int(codes[-1]), "name": "same"}])
    for tmin, tmax in [(-1, 2), (-0.1, 0.2), (0, 0.3), (-0.5, 0.1), (-1, 0.1)]:
        v(tmin=tmin, tmax=tmax, baseline_start=tmin, baseline_end=min(0.0, tmax), peak_start=max(tmin, 0.0), peak_end=tmax)
    v(baseline=False)
    v(baseline_start=0.1, baseline_end=0.3)
    v(baseline_start=-0.05, baseline_end=-0.04)
    v(baseline_start=0.0, baseline_end=0.5)
    for r in [0, 5, 40, 300, 1000]:
        v(reject_uv=r)
    v(peak_start=-0.9, peak_end=-0.5)
    v(peak_start=1.0, peak_end=1.5)
    v(peak_start=0.25, peak_end=0.251)
    v(polarity="negative")
    v(l_freq=5, h_freq=5)
    v(l_freq=None, h_freq=None)

    rnd = random.Random(hash(tuple(chans)) & 0xFFFF)
    for _ in range(30 if QUICK else 150):
        tmin = rnd.choice([round(-1 + 0.05 * i, 2) for i in range(21)])
        tmax = rnd.choice([t for t in [round(0.1 + 0.05 * i, 2) for i in range(39)] if t - tmin >= 0.3] or [2.0])
        bs = round(rnd.uniform(tmin, min(tmax, 0.5) - 0.02), 2)
        be = round(rnd.uniform(bs + 0.02, min(tmax, 0.5)), 2)
        ps = round(rnd.uniform(tmin, tmax - 0.01), 2)
        pe = round(rnd.uniform(ps + 0.01, tmax), 2)
        grid.append(dict(
            conditions=rnd.choice([conds, conds[:1], [{"code": int(c), "name": f"c{c}"} for c in codes[:6]]]),
            l_freq=rnd.choice(HIGH_PASS), h_freq=rnd.choice(LOW_PASS), reference=rnd.choice(["average", "none", rnd.choice(chans)]),
            tmin=tmin, tmax=tmax, baseline=rnd.random() < 0.8, baseline_start=bs, baseline_end=be,
            reject_uv=rnd.choice(range(0, 305, 5)), channel=rnd.choice(chans), peak_start=ps, peak_end=pe,
            polarity=rnd.choice(["positive", "negative"]),
        ))
    return default, grid


def run_case(name, files, expect):
    payload = [("files", (f.name, f.read_bytes(), "application/octet-stream")) for f in files]
    t = time.perf_counter()
    res = call(name, "upload", "post", "/api/data/upload", files=payload)
    up_s = round(time.perf_counter() - t, 1)
    if res is None:
        log(case=name, what="summary", expect=expect, upload="CRASH")
        return
    if res.status_code != 200:
        ok = expect in ("reject", "either")
        log(case=name, what="summary", expect=expect, upload=res.status_code, detail=res.json().get("detail"), verdict="ok" if ok else "UNEXPECTED REJECT", s=up_s)
        return
    if expect == "reject":
        log(case=name, what="summary", expect=expect, upload=200, verdict="UNEXPECTED ACCEPT")
    body = res.json()
    sid, summary = body["session_id"], body["summary"]
    call(name, "events", "get", f"/api/sessions/{sid}/events")
    topo = call(name, "topo", "get", f"/api/sessions/{sid}/topo")
    default, grid = params_for(summary, body["suggested_event_names"])
    n200 = n422 = 0
    for p in grid:
        r = call(name, "process", "post", f"/api/sessions/{sid}/process", json=p)
        if r is None:
            continue
        if r.status_code == 200:
            n200 += 1
            check_process(name, p, r.json())
        else:
            n422 += 1
    dur = summary["duration_s"]
    for start, d in [(0, 10), (dur / 2, 30), (max(dur - 5, 0), 10), (dur + 100, 10), (0, 0.01)]:
        call(name, "raw", "post", f"/api/sessions/{sid}/raw", json={"params": default, "start_s": start, "duration_s": d})
    call(name, "raw-badref", "post", f"/api/sessions/{sid}/raw", json={"params": {**default, "reference": "NOT_A_CHANNEL"}, "start_s": 0, "duration_s": 10})
    call(name, "raw-lp100", "post", f"/api/sessions/{sid}/raw", json={"params": {**default, "h_freq": 100}, "start_s": 0, "duration_s": 10})
    call(name, "export", "post", f"/api/sessions/{sid}/export", json=default)
    call(name, "recording", "get", f"/api/sessions/{sid}/recording.fif")
    log(case=name, what="summary", expect=expect, upload=200, s=up_s, n_channels=summary["n_channels"], sfreq=summary["sfreq"],
        duration_s=round(dur), n_events=summary["n_events"], codes=len(summary["event_counts"]), has_positions=body["has_positions"],
        topo=topo.status_code if topo is not None else "CRASH", process_200=n200, process_4xx=n422)


cases = json.loads((cases_dir / "cases.json").read_text())
todo = [(n, [cases_dir / f for f in fs], e) for n, (fs, e) in cases.items()]
for i, spec in enumerate(EXTRA):
    files = [Path(f) for f in spec.split("|")]
    todo.append((f"dataset:{files[0].name}", files, "ok"))
for name, files, expect in todo:
    if ONLY and name not in ONLY:
        continue
    t = time.perf_counter()
    run_case(name, files, expect)
    print(f"{name:40s} {time.perf_counter() - t:6.1f}s  crashes so far {stats['crash']}, bad {stats['bad']}", flush=True)
log(what="TOTAL", **stats)
print("TOTAL", stats)
