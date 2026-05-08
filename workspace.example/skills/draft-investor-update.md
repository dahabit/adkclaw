---
name: draft-investor-update
when: User asks me to draft a monthly or quarterly investor update
---

When the user asks for an investor update:

1. Pull recent activity from `bank/projects/` (status, milestones, blockers)
2. Pull recent decisions from `bank/decisions/` worth flagging
3. `daily_append` recent entries to surface "what happened this month"
4. Reply with the draft in the **5-block** format:
   - **Highlights** — 3 things to brag about
   - **Lowlights** — 2 things going slower than planned, with reasons
   - **Asks** — what you need from the investor (intros, hires, advice)
   - **Metrics** — top 3 numbers, with deltas vs last update
   - **Looking ahead** — what next month/quarter looks like

Keep the whole draft under 400 words. Investors skim.
