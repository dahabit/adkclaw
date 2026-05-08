---
name: plan-trip
when: User asks me to plan a trip, propose an itinerary, or research destinations
---

When the user asks for a trip plan:

1. Confirm: dates, origin city, destination, budget tier, party size, must-haves, must-avoids
2. `web_search` for: "<destination> 3-day itinerary", "<destination> hidden gems", "<destination> getting around"
3. For top results: `web_fetch` and extract concrete recommendations (places, prices, transit)
4. Reply with:
   - Day-by-day plan with morning/afternoon/evening
   - Transit suggestion between segments
   - 1 alternative if weather/closure breaks plan A
   - Estimated daily spend per person

If anything is uncertain (e.g. visa requirements), say so and recommend verifying with the embassy.
