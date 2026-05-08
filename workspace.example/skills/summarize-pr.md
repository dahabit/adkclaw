---
name: summarize-pr
when: User asks me to review or summarise a GitHub pull request
---

When the user gives me a PR URL or asks "summarise that PR for me":

1. `web_fetch` the PR URL — both the description page and `pull/<n>.diff`
2. Read the diff. Note files touched, lines added/removed, public-API changes
3. Reply with five sections:
   - **Title** — the actual PR title
   - **What changed** — one paragraph in plain language
   - **Risk** — bug surface, breaking-change risk, test coverage gaps
   - **Suggested questions** — 2–3 review questions worth asking
   - **Verdict** — Approve / Request changes / Need info

Keep it under 250 words. Reviewers should still read the diff themselves; this is the prep, not the verdict.
