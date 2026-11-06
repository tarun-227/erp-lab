"""Summarise a sweep_api.py report: per-case outcome, crashes, inconsistent results, 4xx messages, slow calls."""

import collections
import json
import sys

rows = [json.loads(l) for l in open(sys.argv[1], encoding="utf8")]
print(len(rows), "rows")
for r in rows:
    if r.get("what") == "summary":
        print({k: r.get(k) for k in ("case", "expect", "upload", "verdict", "detail", "process_200", "process_4xx", "topo", "s") if r.get(k) is not None})
c = collections.Counter((r["case"], r["what"], (r.get("error") or str(r.get("why") or r.get("body")))[:150]) for r in rows if r.get("result") in ("CRASH", "BAD"))
print("--- crashes/bad")
for k, v in c.most_common(40): print(v, k)
d = collections.Counter((r["what"], str(r.get("detail"))[:110]) for r in rows if r.get("result") == "4xx")
print("--- 4xx messages")
for k, v in d.most_common(40): print(v, k)
s = [r for r in rows if r.get("result") == "SLOW"]
print("--- slow", len(s), [(r["case"], r["what"], r["s"]) for r in s[:10]])
