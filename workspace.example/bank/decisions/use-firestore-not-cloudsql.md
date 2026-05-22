---
date: 2026-04-15
context: Level 5 deployment
status: approved
---

# Decision: Firestore over Cloud SQL for sessions

## Why
- Native GCP service, scales to zero (Cloud SQL has minimum cost)
- No SQL schema to manage; document model fits session shape
- Free tier covers workshop traffic comfortably
- Indexes are auto-managed for the queries we run

## Trade-offs
- Eventual consistency on writes (acceptable for session state, not for financial state)
- Vendor lock-in to GCP (already locked in via Gemini)
- 1 MB document limit (sessions stay well under)

## Reverted if
Session document size approaches 500 KB or query patterns require multi-table JOINs.
