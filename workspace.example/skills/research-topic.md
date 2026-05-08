---
name: research-topic
when: User asks me to research, look up, or explain a current topic
---

When asked to research something:

1. `web_search` for the topic with 3 distinct query phrasings
2. For each top-2 result of each query: `web_fetch` and skim the page
3. Cross-reference the facts that show up in 2+ sources (the corroborated layer)
4. Save the corroborated facts to `bank/facts/` with source + date + confidence
5. Reply with:
   - 3-bullet summary
   - 2 strongest sources cited inline
   - 1 question that further research would answer

Cap web_fetch calls at 6 per topic to keep latency reasonable.
