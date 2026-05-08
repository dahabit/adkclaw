# Pre-Workshop Baseline Survey

A 10-question survey instructors send 7 days before the workshop. Drives:
- Pacing decisions (faster Level 0 if everyone's already on Gemini)
- Pre-workshop nudges (extra setup help for first-time gcloud users)
- Cohort comms tone (more visual aids if many self-taught learners)

Copy into a Google Form, Typeform, or whatever survey tool the cohort prefers. Free / no-tracking versions work fine.

## Questions

1. **What's your day-job role?** (single choice)
   - Backend / API engineer
   - Frontend / web engineer
   - Mobile engineer
   - Data / ML engineer
   - DevOps / SRE / platform
   - Founder / solo / side-project
   - Other (please specify)

2. **How comfortable are you with TypeScript?** (1–5)
   - 1 = never written it
   - 5 = ship it daily

3. **Have you called the Gemini API before?** (single choice)
   - Yes — built something with it
   - Yes — ran a single curl/REPL example
   - No, but I've used another LLM API
   - No, this will be my first time

4. **Have you deployed to Google Cloud before?** (multi-select)
   - [ ] Cloud Run
   - [ ] Cloud Functions
   - [ ] App Engine
   - [ ] Firestore
   - [ ] Cloud Scheduler
   - [ ] Other Google Cloud service
   - [ ] No — this will be my first deployment

5. **Do you already have a Google Cloud project with billing enabled?** (single choice)
   - Yes
   - I have an account but no project yet
   - I don't have a Google Cloud account

6. **What's your dev environment going to be?** (single choice)
   - Cloud Shell (browser-based)
   - macOS (Apple Silicon)
   - macOS (Intel)
   - Linux (native)
   - Windows + WSL 2
   - Windows native (note: not officially supported)

7. **Have you built a Telegram bot before?** (single choice)
   - Yes
   - No, but I've used Telegram
   - No, and I'll need to install it

8. **What outcome do you most want from this workshop?** (free text, ≤3 sentences)

9. **Any blockers or concerns going in?** (free text, optional)

10. **What time zone are you in?** (free text — used for cohort comms scheduling)

## How instructors use the results

- **Pacing**: if >50% of cohort answered "yes" to Q3 (called Gemini before), trim Level 0's "what is generateContent?" walkthrough.
- **Pre-workshop drip**: target Q4 / Q5 negatives with extra "first time on Google Cloud?" tutorial videos.
- **Cohort comms**: cluster Q10 time zones for office-hour scheduling.
- **Anonymized testimonials**: Q8 free-text answers (with consent) feed marketing for the next cohort.

Privacy: collect only what you'll act on. Don't ask for company names, real names, or anything beyond what each question requires.
