---
date: 2026-05-08
source: level_5/codelab.md §6
confidence: high
---

Server-side Firestore SDKs authenticate via IAM and **bypass** Security Rules. Rules are defense-in-depth for client SDKs and for the case where IAM-bypass is later disabled. Both layers matter.
