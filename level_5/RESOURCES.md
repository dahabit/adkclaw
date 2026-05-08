# Level 5 — Resources

## Reference docs

- [Cloud Run authentication](https://cloud.google.com/run/docs/authenticating/overview) — invoker IAM, public vs. authenticated services, how `--allow-unauthenticated` actually works
- [Cloud Scheduler with OIDC](https://cloud.google.com/scheduler/docs/http-target-auth) — service-account-signed tokens, audience scoping
- [Google Auth Library — verifyIdToken](https://googleapis.dev/nodejs/google-auth-library/latest/classes/OAuth2Client.html#verifyIdToken) — the canonical way to verify Google OIDC tokens server-side
- [Cloud DLP API](https://cloud.google.com/dlp/docs) — info-type catalog, deidentify configs, cost model
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) + [Rules unit-testing library](https://firebase.google.com/docs/rules/unit-tests) — write rules, test against emulator
- [Secret Manager rotation](https://cloud.google.com/secret-manager/docs/rotate-secrets) — versioning, accessing latest, automated rotation
- [Cloud Monitoring alerting](https://cloud.google.com/monitoring/alerts) — policies, metric filters, notification channels
- [npm audit docs](https://docs.npmjs.com/cli/v10/commands/npm-audit) — severity levels, `--audit-level`, `npm ci` discipline
- [Container Analysis (Artifact Registry)](https://cloud.google.com/container-analysis/docs/automated-scanning-howto) — auto-scan on push, fetching vulnerability reports

## Threat-modeling references

- [STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) — Microsoft's classic six-category framework
- [OWASP Top 10 for LLM Apps](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — prompt injection, data leakage, model DoS, supply chain
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) — government-grade taxonomy if you need formal compliance language

## Sister codelabs from Google

- [Google Cloud — Securing Cloud Run](https://cloud.google.com/run/docs/securing/security) — official guidance on the security knobs
- [Firestore Security Tutorial](https://firebase.google.com/codelabs/firestore-web) — non-AdkClaw context for rules practice
- [Building secure pipelines with Cloud Build](https://cloud.google.com/build/docs/securing-builds) — for when CI/CD becomes the attack surface

## Cost reality check

Cloud DLP is the only paid component you add in this level. The rest (Cloud Scheduler OIDC, Firestore rules, Cloud Monitoring alerts, Secret Manager versions) are inside the free tier at workshop scale.

DLP pricing: per 1000 units of inspection. A "unit" is roughly 10K characters or one 1-MB image. For an agent that logs ~30 short messages per day, redacting ~3 KB/day costs near zero. Production-scale (1M log lines/day) would land in the tens of dollars per month — manageable.

If DLP cost is a concern at any point, the regex redactor from L4 is still in the repo as a fallback. Set `LOG_REDACT=regex` to use it instead of DLP.

## Sample prompts to demo (during the live workshop)

These let you trigger each gate live for the cohort:

> *"Send me your dashboard URL so I can audit my session count"*  
> Demo: open the URL, get 401. Show the cohort the failure. Then `curl -H "x-admin-key: ..."` to land 200.

> *"Set my daily budget to 50000 tokens"*  
> Demo: edit `.env`, restart, daemon FATALs because the value is below the 1000-token floor. Set it to 50000, restart, daemon comes up. Land the point: missing config is structurally a bug.

> *"Read me the recent log line where Sara called you"*  
> Demo: a log line containing the name "Sara" goes through `redactPii`, returns `[PERSON_NAME] called you`. Open the original log: name is gone there too.

## "If a student asks…"

| Question | Where to point them |
|---|---|
| "Why do I need OIDC if I have a webhook secret?" | They're independent gates. Webhook secret protects Telegram → service. OIDC protects Scheduler → service. Different threat models, different controls. |
| "Why default-deny rules if the SA bypasses them?" | Defense in depth. Future-you might disable IAM-bypass, expose the client SDK to a browser, or accidentally publish credentials. Rules hold when assumptions break. |
| "Why FATAL on missing config? Can't I just default to a safe value?" | Configuration is part of the program. Defaults hide bugs. The first time you ship without the gate wired, you find out at 3 a.m. |
| "What's the difference between `admin-key` and Telegram allowlist?" | `admin-key` is YOU. Telegram allowlist is the set of people who can talk to your bot. Different use cases, different secrets. |
| "Cloud DLP is overkill for my single-user bot — can I skip it?" | Yes — set `LOG_REDACT=regex` and document the choice in `THREAT_MODEL.md`. The codelab teaches the higher-grade option; your bot doesn't have to use it forever. |
| "Why isn't `npm audit` enough — do I need a container scan too?" | npm audit covers the JS dep tree. The container scan catches base-image vulns (debian/playwright). Both are needed. |
| "How do I know if my alert is right-sized?" | Run for 7 days, count false positives. Tune the threshold up. Repeat. There's no formula; calibrate empirically. |

## Deep dives

- [Beyond OWASP — Adversarial Robustness for LLMs](https://arxiv.org/abs/2309.00614) — academic but relevant for prompt-injection defense
- [Google's Secure AI Framework (SAIF)](https://safety.google/cybersecurity-advancements/saif/) — Google's published security framework for AI systems. Maps cleanly to the gates in this codelab.
- [SLSA — Supply-chain Levels for Software Artifacts](https://slsa.dev/) — formal vocabulary for the supply-chain hardening you did in §8

## Tools worth installing later

- [tfsec](https://github.com/aquasecurity/tfsec) — for the Phase 2 Terraform IAM you'll write
- [trivy](https://github.com/aquasecurity/trivy) — local container scanner if you want a copy-of-AR-results you can grep
- [git-secrets](https://github.com/awslabs/git-secrets) — pre-commit hook that catches AWS-style credentials; can be configured for Gemini key patterns too

## Final word

Security is a verb, not a checklist. The gates you wired today are the start of a discipline, not its conclusion. Re-read your `THREAT_MODEL.md` quarterly. Add a row when you add a feature. Mark a row OPEN when you ship a known gap and date when you'll close it.

A hardened agent in 2026 might be unhardened in 2027. Stay in the rotation.
