---
date: 2026-03-12
source: cloud.google.com/run/docs
confidence: high
---

Cloud Run gen2 cold-start for a 1 GB image lands around 2–3 seconds. `--min-instances=1` keeps one warm at the cost of continuous billing — only worth it if cold starts hurt the use case.
